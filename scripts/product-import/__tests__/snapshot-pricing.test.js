import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { parseFxSnapshot } from "../shared/fx-snapshot.js";
import {
  applySnapshotPricing,
  assertSnapshotDraftWriteConfirmation,
  assertSnapshotDraftWriteTarget,
  buildSnapshotDraftTarget,
  deriveSnapshotUnitPrice,
  deriveSnapshotChildUuid,
  parsePositiveSupplierPrice,
  resolveSnapshotRoundingPolicy,
} from "../shared/snapshot-pricing.js";

const HASH = "a".repeat(64);

function snapshot(overrides = {}) {
  return parseFxSnapshot({
    schemaVersion: 1,
    provider: "frankfurter_ecb",
    baseCurrency: "EUR",
    quoteCurrency: "DKK",
    rate: 7.46,
    rateDate: "2026-07-30",
    fetchedAt: "2026-07-31T08:15:00.000Z",
    sourcePayloadSha256: HASH,
    ...overrides,
  });
}

function input(overrides = {}) {
  return {
    supplierPrice: 100,
    fxSnapshot: snapshot(),
    fxSnapshotId: "snapshot-1",
    pricingBuffer: { type: "percent", value: 2 },
    markupPolicy: { type: "percent", value: 60 },
    roundingStepDkk: 1,
    ...overrides,
  };
}

test("snapshot rounding resolves once from immutable extraction evidence", () => {
  assert.deepEqual(
    resolveSnapshotRoundingPolicy({
      embeddedRoundingStepDkk: 5,
      explicitRoundingStepDkk: 1,
      hasExplicitRoundingStep: false,
    }),
    { stepDkk: 5, mode: "ceil_v1" },
  );
  assert.deepEqual(
    resolveSnapshotRoundingPolicy({
      embeddedRoundingStepDkk: 5,
      explicitRoundingStepDkk: 5,
      hasExplicitRoundingStep: true,
    }),
    { stepDkk: 5, mode: "ceil_v1" },
  );

  for (const value of [
    {
      embeddedRoundingStepDkk: 5,
      explicitRoundingStepDkk: 1,
      hasExplicitRoundingStep: true,
    },
    {
      embeddedRoundingStepDkk: 0.05,
      explicitRoundingStepDkk: 0.05,
      hasExplicitRoundingStep: false,
    },
    {
      embeddedRoundingStepDkk: 1001,
      explicitRoundingStepDkk: 1001,
      hasExplicitRoundingStep: false,
    },
  ]) {
    assert.throws(
      () => resolveSnapshotRoundingPolicy(value),
      /Invalid snapshot rounding policy/,
    );
  }
});

test("snapshot draft targets require exact create or revision-checked replace identity", () => {
  const importId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const payloadDigest = "b".repeat(64);

  assert.deepEqual(
    buildSnapshotDraftTarget({
      mode: "create",
      productId: null,
      expectedRevision: 0,
      importId,
      payloadDigest,
    }),
    {
      mode: "create",
      product_id: null,
      expected_revision: 0,
      import_id: importId,
      payload_digest: payloadDigest,
    },
  );
  assert.deepEqual(
    buildSnapshotDraftTarget({
      mode: "replace",
      productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      expectedRevision: 7,
      importId,
      payloadDigest,
    }),
    {
      mode: "replace",
      product_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      expected_revision: 7,
      import_id: importId,
      payload_digest: payloadDigest,
    },
  );

  for (const value of [
    { mode: "create", productId: null, expectedRevision: 1, importId, payloadDigest },
    { mode: "replace", productId: null, expectedRevision: 1, importId, payloadDigest },
    {
      mode: "replace",
      productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      expectedRevision: 0,
      importId,
      payloadDigest,
    },
    {
      mode: "replace",
      productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      expectedRevision: 1,
      importId: "not-a-uuid",
      payloadDigest,
    },
  ]) {
    assert.throws(() => buildSnapshotDraftTarget(value), /Invalid snapshot draft target/);
  }
});

test("snapshot child IDs are stable per import and isolated across imports or content", () => {
  const firstImport = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const secondImport = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const identity = "material:paper-white:0";

  const first = deriveSnapshotChildUuid(firstImport, identity);
  assert.equal(deriveSnapshotChildUuid(firstImport, identity), first);
  assert.notEqual(deriveSnapshotChildUuid(secondImport, identity), first);
  assert.notEqual(
    deriveSnapshotChildUuid(firstImport, "material:paper-blue:0"),
    first,
  );
  assert.match(
    first,
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test("WMD payload construction uses deterministic child IDs from the import identity", () => {
  const source = fs.readFileSync(
    new URL("../../fetch2-wmd-roll-labels.mjs", import.meta.url),
    "utf8",
  );
  const builder = source.slice(
    source.indexOf("function buildSnapshotDraftImportPayload"),
    source.indexOf("async function runImport"),
  );

  assert.match(builder, /deriveSnapshotChildUuid\s*\(/);
  assert.doesNotMatch(builder, /crypto\.randomUUID\s*\(/);
  assert.match(source, /buildSnapshotDraftImportPayload\s*\(\{[\s\S]*?importId:\s*args\.importId/);
});

test("supplier prices must be canonical, finite, and strictly positive", () => {
  assert.equal(parsePositiveSupplierPrice(12.34), 12.34);
  assert.equal(parsePositiveSupplierPrice("12.34"), 12.34);

  for (const value of [null, "", " ", 0, "0", -1, "-1", Infinity, "1e2"]) {
    assert.throws(
      () => parsePositiveSupplierPrice(value),
      /Invalid supplier price/,
    );
  }
  assert.throws(
    () => applySnapshotPricing(input({ supplierPrice: 0 })),
    /Invalid snapshot pricing input/,
  );
});

test("WMD provider response validation uses the strict positive-price boundary", () => {
  const source = fs.readFileSync(
    new URL("../../fetch2-wmd-roll-labels.mjs", import.meta.url),
    "utf8",
  );
  const responseBoundary = source.slice(
    source.indexOf("const resp = json?.data?.response"),
    source.indexOf("const deliveryChargeEur"),
  );

  assert.match(responseBoundary, /parsePositiveSupplierPrice\s*\(resp\.price\)/);
  assert.doesNotMatch(responseBoundary, /Number\s*\(resp\.price\)/);
});

test("snapshot write usage and docs require an explicit import identity", () => {
  const script = fs.readFileSync(
    new URL("../../fetch2-wmd-roll-labels.mjs", import.meta.url),
    "utf8",
  );
  const docs = fs.readFileSync(
    new URL("../../../docs/FETCH2_WMD_ROLL_LABELS_SPEC.md", import.meta.url),
    "utf8",
  );

  assert.match(script, /writeSnapshotDraft\s*&&\s*!importId/);
  assert.match(
    docs,
    /--write-snapshot-draft[^\n`]*--import-id\s+"<uuid>"/,
  );
  assert.match(
    docs,
    /adds[^\n]*rounding_mode[^\n]*wmd_snapshot_draft_import_state/i,
  );
  assert.doesNotMatch(docs, /no tables or columns/i);
});

test("keeps supplier FX, buffer, markup, and final-only rounding as separate evidence", () => {
  const result = applySnapshotPricing(input());

  assert.deepEqual(result, {
    supplierCurrency: "EUR",
    supplierPrice: 100,
    fxSnapshotId: "snapshot-1",
    fxProvider: "frankfurter_ecb",
    fxBaseCurrency: "EUR",
    fxQuoteCurrency: "DKK",
    fxRate: 7.46,
    fxRateDate: "2026-07-30",
    fxFetchedAt: "2026-07-31T08:15:00.000Z",
    fxSourcePayloadSha256: HASH,
    convertedPriceDkk: 746,
    pricingBuffer: { type: "percent", value: 2, amountDkk: 14.92 },
    bufferedCostDkk: 760.92,
    markup: { type: "percent", value: 60, amountDkk: 456.552 },
    unroundedFinalPriceDkk: 1217.472,
    finalPriceDkk: 1218,
    roundingStepDkk: 1,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.pricingBuffer), true);
  assert.equal(Object.isFrozen(result.markup), true);
});

test("snapshot unit prices defer ceil rounding without inflating an exact anchor", () => {
  const unitPrice = deriveSnapshotUnitPrice(100, 0.7);
  const reconstructed = unitPrice * 0.7;
  const scaled = reconstructed;
  const rounded = Math.ceil(
    scaled - Number.EPSILON * Math.max(1, Math.abs(scaled)),
  );

  assert.ok(reconstructed <= 100);
  assert.ok(reconstructed > 99);
  assert.equal(rounded, 100);
  assert.throws(
    () => deriveSnapshotUnitPrice("Infinity", 0.7),
    /Invalid snapshot unit price input/,
  );

  const importer = fs.readFileSync(
    new URL("../../fetch2-wmd-roll-labels.mjs", import.meta.url),
    "utf8",
  );
  assert.match(importer, /unroundedFinalDkk:\s*pricingEvidence\.unroundedFinalPriceDkk/);
  assert.match(importer, /deriveSnapshotUnitPrice\(cheapestUnroundedDkkFinal/);
  assert.doesNotMatch(
    importer.slice(
      importer.indexOf("function buildTierSeriesFromPoints"),
      importer.indexOf("function parseImportRows"),
    ),
    /toFixed\(6\)/,
  );
});

test("zero buffer and zero markup remain explicit frozen evidence", () => {
  const result = applySnapshotPricing(
    input({
      pricingBuffer: { type: "percent", value: 0 },
      markupPolicy: { type: "percent", value: 0 },
    }),
  );

  assert.deepEqual(result.pricingBuffer, { type: "percent", value: 0, amountDkk: 0 });
  assert.deepEqual(result.markup, { type: "percent", value: 0, amountDkk: 0 });
  assert.equal(result.bufferedCostDkk, 746);
  assert.equal(result.finalPriceDkk, 746);
});

test("WMD tiered markup matches the existing zero-buffer boundaries", () => {
  const cases = [
    [2000, 60],
    [2000.01, 50],
    [5000, 50],
    [5000.01, 40],
    [10000, 40],
    [10000.01, 30],
  ];

  for (const [bufferedCostDkk, expectedPercent] of cases) {
    const result = applySnapshotPricing(
      input({
        supplierPrice: bufferedCostDkk,
        fxSnapshot: snapshot({ rate: 1 }),
        pricingBuffer: { type: "percent", value: 0 },
        markupPolicy: { type: "wmd_tiered" },
        roundingStepDkk: 0.01,
      }),
    );

    assert.equal(result.bufferedCostDkk, bufferedCostDkk);
    assert.equal(result.markup.type, "wmd_tiered");
    assert.equal(result.markup.value, expectedPercent);
    assert.equal(
      result.markup.amountDkk,
      Number((bufferedCostDkk * expectedPercent / 100).toFixed(6)),
    );
  }
});

test("WMD tier selection and markup both use buffered DKK cost", () => {
  const result = applySnapshotPricing(
    input({
      supplierPrice: 2000,
      fxSnapshot: snapshot({ rate: 1 }),
      pricingBuffer: { type: "percent", value: 1 },
      markupPolicy: { type: "wmd_tiered" },
    }),
  );

  assert.equal(result.convertedPriceDkk, 2000);
  assert.equal(result.bufferedCostDkk, 2020);
  assert.deepEqual(result.markup, {
    type: "wmd_tiered",
    value: 50,
    amountDkk: 1010,
  });
  assert.equal(result.finalPriceDkk, 3030);
});

test("WMD roll-label threshold markup stays explicit and uses buffered cost", () => {
  const atThreshold = applySnapshotPricing(
    input({
      supplierPrice: 3000,
      fxSnapshot: snapshot({ rate: 1 }),
      pricingBuffer: { type: "percent", value: 0 },
      markupPolicy: {
        type: "threshold_percent",
        thresholdDkk: 3000,
        atOrBelowValue: 70,
        aboveValue: 60,
      },
    }),
  );
  const aboveAfterBuffer = applySnapshotPricing(
    input({
      supplierPrice: 3000,
      fxSnapshot: snapshot({ rate: 1 }),
      pricingBuffer: { type: "percent", value: 1 },
      markupPolicy: {
        type: "threshold_percent",
        thresholdDkk: 3000,
        atOrBelowValue: 70,
        aboveValue: 60,
      },
    }),
  );

  assert.deepEqual(atThreshold.markup, {
    type: "threshold_percent",
    value: 70,
    amountDkk: 2100,
  });
  assert.equal(atThreshold.finalPriceDkk, 5100);
  assert.equal(aboveAfterBuffer.bufferedCostDkk, 3030);
  assert.deepEqual(aboveAfterBuffer.markup, {
    type: "threshold_percent",
    value: 60,
    amountDkk: 1818,
  });
  assert.equal(aboveAfterBuffer.finalPriceDkk, 4848);
});

test("snapshot writes reject published targets before any database mutation", () => {
  const calls = [];
  const database = {
    insert() {
      calls.push("insert");
    },
    update() {
      calls.push("update");
    },
  };

  assert.throws(() => {
    assertSnapshotDraftWriteTarget({ snapshotMode: true, isPublished: true });
    database.update();
  }, /unpublished draft/i);
  assert.deepEqual(calls, []);

  assert.doesNotThrow(() => {
    assertSnapshotDraftWriteTarget({ snapshotMode: true, isPublished: false });
    database.insert();
  });
  assert.deepEqual(calls, ["insert"]);
});

test("snapshot writes require a separate explicit draft-write confirmation", () => {
  assert.throws(
    () =>
      assertSnapshotDraftWriteConfirmation({
        snapshotMode: true,
        writeConfirmed: false,
      }),
    /--write-snapshot-draft/i,
  );
  assert.doesNotThrow(() =>
    assertSnapshotDraftWriteConfirmation({
      snapshotMode: true,
      writeConfirmed: true,
    }),
  );
  assert.doesNotThrow(() =>
    assertSnapshotDraftWriteConfirmation({
      snapshotMode: false,
      writeConfirmed: false,
    }),
  );
  assert.throws(
    () =>
      assertSnapshotDraftWriteConfirmation({
        snapshotMode: false,
        writeConfirmed: true,
      }),
    /requires snapshot pricing evidence/i,
  );
});

test("only the final total is rounded upward to the configured decimal step", () => {
  const belowStep = applySnapshotPricing(
    input({
      supplierPrice: 1.001,
      fxSnapshot: snapshot({ rate: 1 }),
      pricingBuffer: { type: "percent", value: 0 },
      markupPolicy: { type: "percent", value: 0 },
      roundingStepDkk: 0.05,
    }),
  );
  const halfStep = applySnapshotPricing(
    input({
      supplierPrice: 1.025,
      fxSnapshot: snapshot({ rate: 1 }),
      pricingBuffer: { type: "percent", value: 0 },
      markupPolicy: { type: "percent", value: 0 },
      roundingStepDkk: 0.05,
    }),
  );
  const exactStep = applySnapshotPricing(
    input({
      supplierPrice: 1.05,
      fxSnapshot: snapshot({ rate: 1 }),
      pricingBuffer: { type: "percent", value: 0 },
      markupPolicy: { type: "percent", value: 0 },
      roundingStepDkk: 0.05,
    }),
  );

  assert.equal(belowStep.convertedPriceDkk, 1.001);
  assert.equal(belowStep.finalPriceDkk, 1.05);
  assert.equal(halfStep.convertedPriceDkk, 1.025);
  assert.equal(halfStep.finalPriceDkk, 1.05);
  assert.equal(exactStep.finalPriceDkk, 1.05);
});

test("preserves exact derived evidence when a valid decimal cannot round-trip as a Number", () => {
  const result = applySnapshotPricing(
    input({
      supplierPrice: 123.45,
      fxSnapshot: snapshot({ rate: 7.460123 }),
      pricingBuffer: { type: "percent", value: 2.5 },
      markupPolicy: { type: "percent", value: 60.5 },
      roundingStepDkk: 0.01,
    }),
  );

  assert.equal(result.convertedPriceDkk, 920.95218435);
  assert.deepEqual(result.pricingBuffer, {
    type: "percent",
    value: 2.5,
    amountDkk: 23.02380460875,
  });
  assert.equal(result.bufferedCostDkk, 943.97598895875);
  assert.deepEqual(result.markup, {
    type: "percent",
    value: 60.5,
    amountDkk: "571.10547332004375",
  });
  assert.equal(result.finalPriceDkk, 1515.09);
  const roundTrippedEvidence = JSON.parse(JSON.stringify(result));
  assert.deepEqual(roundTrippedEvidence, result);
  assert.equal(roundTrippedEvidence.markup.amountDkk, "571.10547332004375");
});

test("large bounded integer arithmetic remains exact and overflow fails closed", () => {
  const result = applySnapshotPricing(
    input({
      supplierPrice: 1000000,
      fxSnapshot: snapshot({ rate: 100 }),
      pricingBuffer: { type: "percent", value: 0 },
      markupPolicy: { type: "percent", value: 0 },
      roundingStepDkk: 1000,
    }),
  );

  assert.equal(result.convertedPriceDkk, 100000000);
  assert.equal(result.finalPriceDkk, 100000000);
  assert.throws(
    () =>
      applySnapshotPricing(
        input({
          supplierPrice: 1000000,
          fxSnapshot: snapshot({ rate: 100 }),
          pricingBuffer: { type: "percent", value: 100 },
          markupPolicy: { type: "percent", value: 1000 },
        }),
      ),
    /Invalid snapshot pricing input/,
  );
});

test("pricing does not mutate or replace the supplied immutable snapshot", () => {
  const fxSnapshot = snapshot();
  const before = JSON.stringify(fxSnapshot);

  const result = applySnapshotPricing(input({ fxSnapshot }));

  assert.equal(JSON.stringify(fxSnapshot), before);
  assert.equal(Object.isFrozen(fxSnapshot), true);
  assert.equal(result.fxRate, fxSnapshot.rate);
  assert.equal(result.fxRateDate, fxSnapshot.rateDate);
});

test("input key order does not affect canonical output or JSON serialization", () => {
  const ordered = input();
  const reversed = Object.fromEntries(Object.entries(ordered).reverse());
  const first = applySnapshotPricing(ordered);
  const second = applySnapshotPricing(reversed);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(JSON.stringify(applySnapshotPricing(input())), JSON.stringify(first));
});

test("top-level and nested accessor fields are captured exactly once", () => {
  const source = input();
  const reads = {};
  const accessorInput = {};
  for (const [key, value] of Object.entries(source)) {
    Object.defineProperty(accessorInput, key, {
      enumerable: true,
      configurable: true,
      get() {
        reads[`input.${key}`] = (reads[`input.${key}`] ?? 0) + 1;
        return value;
      },
    });
  }

  const bufferReads = {};
  const buffer = {};
  for (const [key, value] of Object.entries(source.pricingBuffer)) {
    Object.defineProperty(buffer, key, {
      enumerable: true,
      get() {
        bufferReads[key] = (bufferReads[key] ?? 0) + 1;
        return value;
      },
    });
  }
  Object.defineProperty(accessorInput, "pricingBuffer", {
    enumerable: true,
    configurable: true,
    get() {
      reads["input.pricingBuffer"] = (reads["input.pricingBuffer"] ?? 0) + 1;
      return buffer;
    },
  });

  const markupReads = {};
  const markup = {};
  for (const [key, value] of Object.entries(source.markupPolicy)) {
    Object.defineProperty(markup, key, {
      enumerable: true,
      get() {
        markupReads[key] = (markupReads[key] ?? 0) + 1;
        return value;
      },
    });
  }
  Object.defineProperty(accessorInput, "markupPolicy", {
    enumerable: true,
    configurable: true,
    get() {
      reads["input.markupPolicy"] = (reads["input.markupPolicy"] ?? 0) + 1;
      return markup;
    },
  });

  const result = applySnapshotPricing(accessorInput);
  assert.equal(result.finalPriceDkk, 1218);
  assert.deepEqual(reads, {
    "input.supplierPrice": 1,
    "input.fxSnapshot": 1,
    "input.fxSnapshotId": 1,
    "input.pricingBuffer": 1,
    "input.markupPolicy": 1,
    "input.roundingStepDkk": 1,
  });
  assert.deepEqual(bufferReads, { type: 1, value: 1 });
  assert.deepEqual(markupReads, { type: 1, value: 1 });
});

test("snapshot accessor fields are captured once by the Task 2 contract", () => {
  const expected = {
    schemaVersion: 1,
    provider: "frankfurter_ecb",
    baseCurrency: "EUR",
    quoteCurrency: "DKK",
    rate: 7.46,
    rateDate: "2026-07-30",
    fetchedAt: "2026-07-31T08:15:00.000Z",
    sourcePayloadSha256: HASH,
  };
  const reads = {};
  const accessorSnapshot = {};
  for (const [key, value] of Object.entries(expected)) {
    Object.defineProperty(accessorSnapshot, key, {
      enumerable: true,
      get() {
        reads[key] = (reads[key] ?? 0) + 1;
        return value;
      },
    });
  }

  const result = applySnapshotPricing(input({ fxSnapshot: accessorSnapshot }));
  assert.equal(result.fxRate, 7.46);
  assert.deepEqual(reads, Object.fromEntries(Object.keys(expected).map((key) => [key, 1])));
});

test("hostile proxies and access failures normalize without leaking raw errors", () => {
  const leaked = new Error("hostile proxy trap detail");
  const hostile = new Proxy(input(), {
    get(target, property, receiver) {
      if (property === "supplierPrice") throw leaked;
      return Reflect.get(target, property, receiver);
    },
  });
  const hostilePolicy = new Proxy({ type: "percent", value: 2 }, {
    ownKeys() {
      throw leaked;
    },
  });

  for (const value of [hostile, input({ pricingBuffer: hostilePolicy })]) {
    assert.throws(
      () => applySnapshotPricing(value),
      (error) => {
        assert.notEqual(error, leaked);
        assert.equal(error?.constructor, TypeError);
        assert.equal(error?.message, "Invalid snapshot pricing input");
        return true;
      },
    );
  }
});

test("unknown, missing, opaque-factor, inherited, and symbol fields fail closed", () => {
  const inherited = Object.create({ combinedMultiplier: 1.6 });
  Object.assign(inherited, input());
  const withSymbol = input();
  withSymbol[Symbol("hidden")] = 1;

  const invalid = [
    { ...input(), unexpected: true },
    { ...input(), combinedMultiplier: 1.6 },
    { ...input(), allInFactor: 12 },
    { ...input(), factor: 12 },
    Object.fromEntries(Object.entries(input()).filter(([key]) => key !== "fxSnapshotId")),
    inherited,
    withSymbol,
  ];

  for (const value of invalid) {
    assert.throws(() => applySnapshotPricing(value), /Invalid snapshot pricing input/);
  }
});

test("malformed snapshot IDs, snapshots, policies, and rules fail closed", () => {
  const invalidInputs = [
    input({ fxSnapshotId: "" }),
    input({ fxSnapshotId: " snapshot-1" }),
    input({ fxSnapshotId: "x".repeat(129) }),
    input({ fxSnapshot: null }),
    input({ pricingBuffer: null }),
    input({ pricingBuffer: { type: "fixed", value: 2 } }),
    input({ pricingBuffer: { type: "percent", value: 2, hidden: 1 } }),
    input({ markupPolicy: { type: "combined", value: 60 } }),
    input({ markupPolicy: { type: "wmd_tiered", value: 60 } }),
    input({ markupPolicy: { type: "percent" } }),
    input({ markupPolicy: { type: "percent", value: 60, rule: "other" } }),
    input({
      markupPolicy: {
        type: "threshold_percent",
        thresholdDkk: 3000,
        atOrBelowValue: 70,
      },
    }),
    input({
      markupPolicy: {
        type: "threshold_percent",
        thresholdDkk: 3000,
        atOrBelowValue: 70,
        aboveValue: 60,
        hidden: true,
      },
    }),
  ];

  for (const value of invalidInputs) {
    assert.throws(() => applySnapshotPricing(value), /Invalid snapshot pricing input/);
  }
});

test("negative, nonfinite, exponent, unsafe, out-of-range, and overprecision numbers fail", () => {
  const invalidInputs = [
    input({ supplierPrice: -1 }),
    input({ supplierPrice: -0 }),
    input({ supplierPrice: Number.NaN }),
    input({ supplierPrice: Number.POSITIVE_INFINITY }),
    input({ supplierPrice: 1e-7 }),
    input({ supplierPrice: Number.MAX_SAFE_INTEGER + 1 }),
    input({ supplierPrice: "100" }),
    input({ supplierPrice: 1000000.000001 }),
    input({ fxSnapshot: snapshot({ rate: 7.460123456 }) }),
    input({ pricingBuffer: { type: "percent", value: -1 } }),
    input({ pricingBuffer: { type: "percent", value: 100.0001 } }),
    input({ markupPolicy: { type: "percent", value: -1 } }),
    input({ markupPolicy: { type: "percent", value: 1000.0001 } }),
    input({
      markupPolicy: {
        type: "threshold_percent",
        thresholdDkk: 0,
        atOrBelowValue: 70,
        aboveValue: 60,
      },
    }),
    input({
      markupPolicy: {
        type: "threshold_percent",
        thresholdDkk: 3000,
        atOrBelowValue: -1,
        aboveValue: 60,
      },
    }),
    input({ roundingStepDkk: 0 }),
    input({ roundingStepDkk: -1 }),
    input({ roundingStepDkk: 0.001 }),
    input({ roundingStepDkk: 1000.01 }),
  ];

  for (const value of invalidInputs) {
    assert.throws(() => applySnapshotPricing(value), /Invalid snapshot pricing input/);
  }
});

test("non-plain policy values and prototype coercion are never trusted", () => {
  let coercions = 0;
  const hostileNumber = {
    valueOf() {
      coercions += 1;
      return 2;
    },
  };

  assert.throws(
    () => applySnapshotPricing(input({ pricingBuffer: { type: "percent", value: hostileNumber } })),
    /Invalid snapshot pricing input/,
  );
  assert.equal(coercions, 0);
  assert.throws(
    () => applySnapshotPricing(input({ markupPolicy: new Map([["type", "percent"]]) })),
    /Invalid snapshot pricing input/,
  );
});
