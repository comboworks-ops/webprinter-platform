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
const SNAPSHOT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
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
    const markupPercent =
      markupPolicy.type === "percent"
        ? parseDecimalNumber(markupPolicy.value, {
            maximum: MAX_MARKUP_PERCENT,
            maximumScale: 4,
          })
        : selectWmdTierPercent(bufferedCostDkk);
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

function captureMarkupPolicy(value) {
  assertPlainRecord(value);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) throw invalidPricingInput();

  const isPercentShape = hasExactKeys(ownKeys, PERCENT_POLICY_KEYS);
  const isWmdShape = hasExactKeys(ownKeys, WMD_POLICY_KEYS);
  if (!isPercentShape && !isWmdShape) throw invalidPricingInput();

  const type = value.type;
  if (isPercentShape && type === "percent") return { type, value: value.value };
  if (isWmdShape && type === "wmd_tiered") return { type };
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
