import { resolveTierMultiplier, roundToStep } from "../ul-prices.js";

const DEFAULT_WMD_TIERS = Object.freeze([
  { max_dkk_base: 2000, multiplier: 1.6 },
  { max_dkk_base: 5000, multiplier: 1.5 },
  { max_dkk_base: 10000, multiplier: 1.4 },
  { multiplier: 1.3 },
]);

export const CONVERSION_RULES = Object.freeze({
  wmd_tiered_fx_7_5: Object.freeze({
    key: "wmd_tiered_fx_7_5",
    type: "tier_multiplier",
    eurToDkk: 7.5,
    roundingStep: 1,
    tiers: DEFAULT_WMD_TIERS,
  }),
  wmd_tiered_fx_7_6: Object.freeze({
    key: "wmd_tiered_fx_7_6",
    type: "tier_multiplier",
    eurToDkk: 7.6,
    roundingStep: 1,
    tiers: DEFAULT_WMD_TIERS,
  }),
  wmd_roll_labels_threshold_fx_7_6: Object.freeze({
    key: "wmd_roll_labels_threshold_fx_7_6",
    type: "threshold_markup",
    eurToDkk: 7.6,
    roundingStep: 1,
    thresholdDkk: 3000,
    markupLowPct: 70,
    markupHighPct: 60,
  }),
  pixart_markup_80pct_fx_7_6: Object.freeze({
    key: "pixart_markup_80pct_fx_7_6",
    type: "fixed_markup",
    eurToDkk: 7.6,
    roundingStep: 1,
    markupPct: 80,
  }),
});

function toFiniteNumber(value, fieldName) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`${fieldName} must be a finite number`);
  }
  return num;
}

function getRule(ruleOrKey) {
  if (typeof ruleOrKey === "string") {
    const resolved = CONVERSION_RULES[ruleOrKey];
    if (!resolved) {
      throw new Error(`Unknown conversion rule: ${ruleOrKey}`);
    }
    return resolved;
  }

  if (!ruleOrKey || typeof ruleOrKey !== "object") {
    throw new Error("Conversion rule must be a rule key or config object");
  }

  return ruleOrKey;
}

function finalizeConvertedAmount(value, rule) {
  const rounded = roundToStep(value, toFiniteNumber(rule.roundingStep ?? 1, "rule.roundingStep"));
  if (rule.integerResult === false) {
    const precision = Number.isFinite(Number(rule.precision)) ? Number(rule.precision) : 6;
    return Number(rounded.toFixed(precision));
  }
  return Math.round(rounded);
}

export function applyConversionRule(inputAmount, ruleOrKey) {
  const amount = toFiniteNumber(inputAmount, "inputAmount");
  if (amount < 0) {
    throw new Error("inputAmount must be zero or positive");
  }

  const rule = getRule(ruleOrKey);
  const eurToDkk = toFiniteNumber(rule.eurToDkk, "rule.eurToDkk");
  const baseDkk = amount * eurToDkk;

  if (rule.type === "tier_multiplier") {
    const tierMultiplier = resolveTierMultiplier(baseDkk, rule.tiers);
    const finalPriceDkk = finalizeConvertedAmount(baseDkk * tierMultiplier, rule);
    return {
      ruleKey: rule.key || null,
      supplierPrice: amount,
      convertedPriceDkk: Number(baseDkk.toFixed(4)),
      finalPriceDkk,
      tierMultiplier,
      factor: Number((eurToDkk * tierMultiplier).toFixed(4)),
    };
  }

  if (rule.type === "threshold_markup") {
    const thresholdDkk = toFiniteNumber(rule.thresholdDkk, "rule.thresholdDkk");
    const markupLowPct = toFiniteNumber(rule.markupLowPct, "rule.markupLowPct");
    const markupHighPct = toFiniteNumber(rule.markupHighPct, "rule.markupHighPct");
    const markupPct = baseDkk > thresholdDkk ? markupHighPct : markupLowPct;
    const finalPriceDkk = finalizeConvertedAmount(baseDkk * (1 + markupPct / 100), rule);
    return {
      ruleKey: rule.key || null,
      supplierPrice: amount,
      convertedPriceDkk: Number(baseDkk.toFixed(4)),
      finalPriceDkk,
      markupPct,
      factor: Number((eurToDkk * (1 + markupPct / 100)).toFixed(4)),
    };
  }

  if (rule.type === "fixed_markup") {
    const markupPct = toFiniteNumber(rule.markupPct, "rule.markupPct");
    const finalPriceDkk = finalizeConvertedAmount(baseDkk * (1 + markupPct / 100), rule);
    return {
      ruleKey: rule.key || null,
      supplierPrice: amount,
      convertedPriceDkk: Number(baseDkk.toFixed(4)),
      finalPriceDkk,
      markupPct,
      factor: Number((eurToDkk * (1 + markupPct / 100)).toFixed(4)),
    };
  }

  throw new Error(`Unsupported conversion rule type: ${rule.type}`);
}
