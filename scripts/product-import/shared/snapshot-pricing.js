import { createHash } from "node:crypto";

import { parseFxSnapshot } from "./fx-snapshot.js";

const TOP_LEVEL_KEYS = Object.freeze([
  "supplierPrice",
  "fxSnapshot",
  "fxSnapshotId",
  "pricingBuffer",
  "markupPolicy",
  "roundingStepDkk",
]);
const SNAPSHOT_KEYS = Object.freeze([
  "schemaVersion",
  "provider",
  "baseCurrency",
  "quoteCurrency",
  "rate",
  "rateDate",
  "fetchedAt",
  "sourcePayloadSha256",
]);
const PERCENT_POLICY_KEYS = Object.freeze(["type", "value"]);
const WMD_POLICY_KEYS = Object.freeze(["type"]);
const THRESHOLD_POLICY_KEYS = Object.freeze([
  "type",
  "thresholdDkk",
  "atOrBelowValue",
  "aboveValue",
]);
const WRITE_TARGET_KEYS = Object.freeze(["snapshotMode", "isPublished"]);
const WRITE_CONFIRMATION_KEYS = Object.freeze(["snapshotMode", "writeConfirmed"]);
const ROUNDING_POLICY_KEYS = Object.freeze([
  "embeddedRoundingStepDkk",
  "explicitRoundingStepDkk",
  "hasExplicitRoundingStep",
]);
const DRAFT_TARGET_KEYS = Object.freeze([
  "mode",
  "productId",
  "expectedRevision",
  "importId",
  "payloadDigest",
]);
const SNAPSHOT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const DECIMAL_NUMBER = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

const MAX_SUPPLIER_PRICE = decimalLiteral("1000000");
const MAX_FX_RATE = decimalLiteral("100");
const MAX_BUFFER_PERCENT = decimalLiteral("100");
const MAX_MARKUP_PERCENT = decimalLiteral("1000");
const MAX_ROUNDING_STEP = decimalLiteral("1000");
const MAX_EVIDENCE_DKK = decimalLiteral("1000000000");
const ZERO = decimalLiteral("0");
const WMD_TIER_BOUNDARIES = Object.freeze([
  Object.freeze({ maximum: decimalLiteral("2000"), percent: decimalLiteral("60") }),
  Object.freeze({ maximum: decimalLiteral("5000"), percent: decimalLiteral("50") }),
  Object.freeze({ maximum: decimalLiteral("10000"), percent: decimalLiteral("40") }),
  Object.freeze({ maximum: null, percent: decimalLiteral("30") }),
]);

/**
 * Applies an explicit immutable EUR/DKK snapshot to a supplier price. Decimal
 * inputs are converted to bounded BigInt coefficients before arithmetic. FX,
 * buffer, and markup are never merged; only the final selling price is rounded
 * upward to the configured commercial price step. Evidence decimals are
 * numbers when their canonical decimal round-trips exactly through a
 * JavaScript Number; otherwise they are canonical decimal strings so no
 * derived evidence is silently rounded or rejected.
 */
export function applySnapshotPricing(untrustedInput) {
  try {
    const input = captureExactRecord(untrustedInput, TOP_LEVEL_KEYS);
    const rawSnapshot = captureExactRecord(input.fxSnapshot, SNAPSHOT_KEYS);
    const fxSnapshot = parseFxSnapshot(rawSnapshot);

    if (typeof input.fxSnapshotId !== "string" || !SNAPSHOT_ID.test(input.fxSnapshotId)) {
      throw invalidPricingInput();
    }

    const supplierPrice = parseDecimalNumber(input.supplierPrice, {
      maximum: MAX_SUPPLIER_PRICE,
      maximumScale: 6,
      positive: true,
    });
    const fxRate = parseDecimalNumber(fxSnapshot.rate, {
      maximum: MAX_FX_RATE,
      maximumScale: 6,
      positive: true,
    });
    const roundingStepDkk = parseDecimalNumber(input.roundingStepDkk, {
      maximum: MAX_ROUNDING_STEP,
      maximumScale: 2,
      positive: true,
    });

    const pricingBuffer = captureExactRecord(input.pricingBuffer, PERCENT_POLICY_KEYS);
    if (pricingBuffer.type !== "percent") throw invalidPricingInput();
    const bufferPercent = parseDecimalNumber(pricingBuffer.value, {
      maximum: MAX_BUFFER_PERCENT,
      maximumScale: 4,
    });

    const convertedPriceDkk = multiplyDecimal(supplierPrice, fxRate);
    assertMaximum(convertedPriceDkk, MAX_EVIDENCE_DKK);
    const bufferAmountDkk = percentageOf(convertedPriceDkk, bufferPercent);
    assertMaximum(bufferAmountDkk, MAX_EVIDENCE_DKK);
    const bufferedCostDkk = addDecimal(convertedPriceDkk, bufferAmountDkk);
    assertMaximum(bufferedCostDkk, MAX_EVIDENCE_DKK);

    const markupPolicy = captureMarkupPolicy(input.markupPolicy);
    const markupPercent = selectMarkupPercent(markupPolicy, bufferedCostDkk);
    const markupAmountDkk = percentageOf(bufferedCostDkk, markupPercent);
    assertMaximum(markupAmountDkk, MAX_EVIDENCE_DKK);

    const unroundedFinalPriceDkk = addDecimal(bufferedCostDkk, markupAmountDkk);
    assertMaximum(unroundedFinalPriceDkk, MAX_EVIDENCE_DKK);
    const finalPriceDkk = roundUpToStep(unroundedFinalPriceDkk, roundingStepDkk);
    assertMaximum(finalPriceDkk, MAX_EVIDENCE_DKK);

    return freezeEvidence({
      supplierCurrency: fxSnapshot.baseCurrency,
      supplierPrice: toEvidenceDecimal(supplierPrice),
      fxSnapshotId: input.fxSnapshotId,
      fxProvider: fxSnapshot.provider,
      fxBaseCurrency: fxSnapshot.baseCurrency,
      fxQuoteCurrency: fxSnapshot.quoteCurrency,
      fxRate: toEvidenceDecimal(fxRate),
      fxRateDate: fxSnapshot.rateDate,
      fxFetchedAt: fxSnapshot.fetchedAt,
      fxSourcePayloadSha256: fxSnapshot.sourcePayloadSha256,
      convertedPriceDkk: toEvidenceDecimal(convertedPriceDkk),
      pricingBuffer: {
        type: "percent",
        value: toEvidenceDecimal(bufferPercent),
        amountDkk: toEvidenceDecimal(bufferAmountDkk),
      },
      bufferedCostDkk: toEvidenceDecimal(bufferedCostDkk),
      markup: {
        type: markupPolicy.type,
        value: toEvidenceDecimal(markupPercent),
        amountDkk: toEvidenceDecimal(markupAmountDkk),
      },
      finalPriceDkk: toEvidenceDecimal(finalPriceDkk),
      roundingStepDkk: toEvidenceDecimal(roundingStepDkk),
    });
  } catch {
    throw invalidPricingInput();
  }
}

/**
 * Keeps the opt-in snapshot path from touching a published product. Legacy
 * imports retain their existing behavior when snapshotMode is false.
 */
export function assertSnapshotDraftWriteTarget(untrustedInput) {
  const input = captureExactRecord(untrustedInput, WRITE_TARGET_KEYS);
  if (
    typeof input.snapshotMode !== "boolean" ||
    typeof input.isPublished !== "boolean"
  ) {
    throw invalidPricingInput();
  }
  if (input.snapshotMode && input.isPublished) {
    throw new Error("Snapshot pricing may write only to an unpublished draft");
  }
}

/**
 * Snapshot imports are deliberately double opt-in: selecting snapshot pricing
 * does not itself authorize a database write. Legacy imports are unchanged.
 */
export function assertSnapshotDraftWriteConfirmation(untrustedInput) {
  const input = captureExactRecord(untrustedInput, WRITE_CONFIRMATION_KEYS);
  if (
    typeof input.snapshotMode !== "boolean" ||
    typeof input.writeConfirmed !== "boolean"
  ) {
    throw invalidPricingInput();
  }
  if (input.snapshotMode && !input.writeConfirmed) {
    throw new Error(
      "Snapshot pricing writes require --write-snapshot-draft",
    );
  }
  if (!input.snapshotMode && input.writeConfirmed) {
    throw new Error(
      "--write-snapshot-draft requires snapshot pricing evidence",
    );
  }
}

export function resolveSnapshotRoundingPolicy(untrustedInput) {
  try {
    const input = captureExactRecord(untrustedInput, ROUNDING_POLICY_KEYS);
    if (typeof input.hasExplicitRoundingStep !== "boolean") throw invalidPricingInput();
    const embedded = input.embeddedRoundingStepDkk;
    const explicit = input.explicitRoundingStepDkk;
    if (
      typeof embedded !== "number" ||
      !Number.isSafeInteger(embedded) ||
      embedded < 1 ||
      embedded > 1_000 ||
      typeof explicit !== "number" ||
      !Number.isFinite(explicit)
    ) {
      throw invalidPricingInput();
    }
    if (input.hasExplicitRoundingStep && explicit !== embedded) {
      throw invalidPricingInput();
    }
    const stepDkk = input.hasExplicitRoundingStep ? explicit : embedded;
    if (!Number.isSafeInteger(stepDkk) || stepDkk < 1 || stepDkk > 1_000) {
      throw invalidPricingInput();
    }
    return Object.freeze({ stepDkk, mode: "ceil_v1" });
  } catch {
    throw new TypeError("Invalid snapshot rounding policy");
  }
}

export function buildSnapshotDraftTarget(untrustedInput) {
  try {
    const input = captureExactRecord(untrustedInput, DRAFT_TARGET_KEYS);
    if (
      (input.mode !== "create" && input.mode !== "replace") ||
      !UUID.test(input.importId) ||
      !SHA256.test(input.payloadDigest) ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0
    ) {
      throw invalidPricingInput();
    }
    if (
      (input.mode === "create" &&
        (input.productId !== null || input.expectedRevision !== 0)) ||
      (input.mode === "replace" &&
        (typeof input.productId !== "string" ||
          !UUID.test(input.productId) ||
          input.expectedRevision < 1))
    ) {
      throw invalidPricingInput();
    }
    return Object.freeze({
      mode: input.mode,
      product_id: input.productId,
      expected_revision: input.expectedRevision,
      import_id: input.importId.toLowerCase(),
      payload_digest: input.payloadDigest,
    });
  } catch {
    throw new TypeError("Invalid snapshot draft target");
  }
}

export function deriveSnapshotChildUuid(importId, contentIdentity) {
  if (
    typeof importId !== "string" ||
    !UUID.test(importId) ||
    typeof contentIdentity !== "string" ||
    contentIdentity.length < 1 ||
    contentIdentity.length > 512 ||
    /[\u0000-\u001f\u007f]/.test(contentIdentity)
  ) {
    throw new TypeError("Invalid snapshot child identity");
  }

  const namespace = Buffer.from(importId.replaceAll("-", ""), "hex");
  const bytes = createHash("sha1")
    .update(namespace)
    .update(Buffer.from(contentIdentity, "utf8"))
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${
    hex.slice(16, 20)
  }-${hex.slice(20)}`;
}

export function parsePositiveSupplierPrice(value) {
  const text = typeof value === "number"
    ? String(value)
    : typeof value === "string"
    ? value
    : "";
  const match = DECIMAL_NUMBER.exec(text);
  if (
    !match ||
    (match[2]?.length ?? 0) > 6 ||
    !Number.isFinite(Number(text)) ||
    Number(text) <= 0 ||
    Number(text) > 1_000_000
  ) {
    throw new TypeError("Invalid supplier price");
  }
  return Number(text);
}

function captureMarkupPolicy(value) {
  assertPlainRecord(value);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) throw invalidPricingInput();

  const isPercentShape = hasExactKeys(ownKeys, PERCENT_POLICY_KEYS);
  const isWmdShape = hasExactKeys(ownKeys, WMD_POLICY_KEYS);
  const isThresholdShape = hasExactKeys(ownKeys, THRESHOLD_POLICY_KEYS);
  if (!isPercentShape && !isWmdShape && !isThresholdShape) {
    throw invalidPricingInput();
  }

  const type = value.type;
  if (isPercentShape && type === "percent") return { type, value: value.value };
  if (isWmdShape && type === "wmd_tiered") return { type };
  if (isThresholdShape && type === "threshold_percent") {
    return {
      type,
      thresholdDkk: value.thresholdDkk,
      atOrBelowValue: value.atOrBelowValue,
      aboveValue: value.aboveValue,
    };
  }
  throw invalidPricingInput();
}

function selectMarkupPercent(markupPolicy, bufferedCostDkk) {
  if (markupPolicy.type === "percent") {
    return parseDecimalNumber(markupPolicy.value, {
      maximum: MAX_MARKUP_PERCENT,
      maximumScale: 4,
    });
  }
  if (markupPolicy.type === "wmd_tiered") {
    return selectWmdTierPercent(bufferedCostDkk);
  }
  if (markupPolicy.type === "threshold_percent") {
    const thresholdDkk = parseDecimalNumber(markupPolicy.thresholdDkk, {
      maximum: MAX_EVIDENCE_DKK,
      maximumScale: 6,
      positive: true,
    });
    const atOrBelowValue = parseDecimalNumber(markupPolicy.atOrBelowValue, {
      maximum: MAX_MARKUP_PERCENT,
      maximumScale: 4,
    });
    const aboveValue = parseDecimalNumber(markupPolicy.aboveValue, {
      maximum: MAX_MARKUP_PERCENT,
      maximumScale: 4,
    });
    return compareDecimal(bufferedCostDkk, thresholdDkk) <= 0
      ? atOrBelowValue
      : aboveValue;
  }
  throw invalidPricingInput();
}

function captureExactRecord(value, expectedKeys) {
  assertPlainRecord(value);
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.some((key) => typeof key !== "string") ||
    !hasExactKeys(ownKeys, expectedKeys)
  ) {
    throw invalidPricingInput();
  }

  const captured = {};
  for (const key of expectedKeys) captured[key] = value[key];
  return captured;
}

function hasExactKeys(actualKeys, expectedKeys) {
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => actualKeys.includes(key))
  );
}

function assertPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw invalidPricingInput();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw invalidPricingInput();
}

function parseDecimalNumber(value, options) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Object.is(value, -0) ||
    (Number.isInteger(value) && !Number.isSafeInteger(value))
  ) {
    throw invalidPricingInput();
  }

  const text = String(value);
  const match = DECIMAL_NUMBER.exec(text);
  if (!match) throw invalidPricingInput();
  const fraction = match[2] ?? "";
  if (fraction.length > options.maximumScale) throw invalidPricingInput();

  const parsed = normalizeDecimal({
    coefficient: BigInt(`${match[1]}${fraction}`),
    scale: fraction.length,
  });
  if (options.positive && compareDecimal(parsed, ZERO) <= 0) throw invalidPricingInput();
  if (compareDecimal(parsed, options.maximum) > 0) throw invalidPricingInput();
  return parsed;
}

function decimalLiteral(text) {
  const match = DECIMAL_NUMBER.exec(text);
  if (!match) throw new TypeError("Invalid internal decimal literal");
  const fraction = match[2] ?? "";
  return normalizeDecimal({
    coefficient: BigInt(`${match[1]}${fraction}`),
    scale: fraction.length,
  });
}

function normalizeDecimal(decimal) {
  let { coefficient, scale } = decimal;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale };
}

function multiplyDecimal(left, right) {
  return normalizeDecimal({
    coefficient: left.coefficient * right.coefficient,
    scale: left.scale + right.scale,
  });
}

function percentageOf(amount, percent) {
  const product = multiplyDecimal(amount, percent);
  return normalizeDecimal({
    coefficient: product.coefficient,
    scale: product.scale + 2,
  });
}

function addDecimal(left, right) {
  const scale = Math.max(left.scale, right.scale);
  return normalizeDecimal({
    coefficient:
      left.coefficient * powerOfTen(scale - left.scale) +
      right.coefficient * powerOfTen(scale - right.scale),
    scale,
  });
}

function compareDecimal(left, right) {
  const scale = Math.max(left.scale, right.scale);
  const leftCoefficient = left.coefficient * powerOfTen(scale - left.scale);
  const rightCoefficient = right.coefficient * powerOfTen(scale - right.scale);
  if (leftCoefficient < rightCoefficient) return -1;
  if (leftCoefficient > rightCoefficient) return 1;
  return 0;
}

function roundUpToStep(amount, step) {
  const scale = Math.max(amount.scale, step.scale);
  const amountCoefficient = amount.coefficient * powerOfTen(scale - amount.scale);
  const stepCoefficient = step.coefficient * powerOfTen(scale - step.scale);
  const wholeSteps = amountCoefficient / stepCoefficient;
  const remainder = amountCoefficient % stepCoefficient;
  return normalizeDecimal({
    coefficient: (wholeSteps + (remainder === 0n ? 0n : 1n)) * stepCoefficient,
    scale,
  });
}

function selectWmdTierPercent(bufferedCostDkk) {
  for (const tier of WMD_TIER_BOUNDARIES) {
    if (tier.maximum === null || compareDecimal(bufferedCostDkk, tier.maximum) <= 0) {
      return tier.percent;
    }
  }
  throw invalidPricingInput();
}

function assertMaximum(value, maximum) {
  if (compareDecimal(value, maximum) > 0) throw invalidPricingInput();
}

/**
 * @returns {number | string} An exact Number when round-trippable, otherwise
 * the canonical non-exponent decimal string.
 */
function toEvidenceDecimal(decimal) {
  const canonical = decimalToString(decimal);
  const value = Number(canonical);
  if (!Number.isFinite(value)) return canonical;
  const roundTrip = String(value);
  if (
    DECIMAL_NUMBER.test(roundTrip) &&
    compareDecimal(decimalLiteral(roundTrip), decimal) === 0
  ) {
    return value;
  }
  return canonical;
}

function decimalToString(decimal) {
  const normalized = normalizeDecimal(decimal);
  const digits = normalized.coefficient.toString();
  if (normalized.scale === 0) return digits;
  if (digits.length <= normalized.scale) {
    return `0.${"0".repeat(normalized.scale - digits.length)}${digits}`;
  }
  return `${digits.slice(0, -normalized.scale)}.${digits.slice(-normalized.scale)}`;
}

function powerOfTen(exponent) {
  return 10n ** BigInt(exponent);
}

function freezeEvidence(evidence) {
  Object.freeze(evidence.pricingBuffer);
  Object.freeze(evidence.markup);
  return Object.freeze(evidence);
}

function invalidPricingInput() {
  return new TypeError("Invalid snapshot pricing input");
}
