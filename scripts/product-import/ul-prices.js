import { DEFAULT_TIERS } from "./blueprint-schema.js";

function cleanNumberText(value) {
  return value
    .replace(/\u00A0/g, " ")
    .replace(/[\s]/g, "")
    .replace(/[^0-9,.-]/g, "");
}

export function parseLocalizedNumber(value) {
  if (typeof value !== "string") return null;

  let cleaned = cleanNumberText(value);
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    cleaned = cleaned.split(thousandSeparator).join("");
    if (decimalSeparator === ",") {
      cleaned = cleaned.replace(",", ".");
    }
  } else if (hasComma) {
    const parts = cleaned.split(",");
    if (parts.length > 2) {
      cleaned = parts.join("");
    } else if (parts[1] && parts[1].length === 3) {
      cleaned = parts.join("");
    } else {
      cleaned = cleaned.replace(",", ".");
    }
  } else if (hasDot) {
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      cleaned = parts.join("");
    } else if (parts[1] && parts[1].length === 3) {
      cleaned = parts.join("");
    }
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function extractEurAmount(text) {
  if (typeof text !== "string" || !text.trim()) return null;

  const candidates = [
    /(?:€|eur)\s*([0-9][0-9\s.,]*)/i,
    /([0-9][0-9\s.,]*)\s*(?:€|eur)\b/i,
  ];

  for (const pattern of candidates) {
    const match = text.match(pattern);
    if (!match || !match[1]) continue;
    const value = parseLocalizedNumber(match[1]);
    if (value != null) return value;
  }

  // Last-resort fallback: first number-looking token.
  const fallback = text.match(/([0-9][0-9\s.,]*)/);
  if (fallback && fallback[1]) {
    const parsed = parseLocalizedNumber(fallback[1]);
    if (parsed != null) return parsed;
  }

  return null;
}

export function extractQuantity(text) {
  if (typeof text !== "string" || !text.trim()) return null;

  const patterns = [
    /(?:qty|quantity|antal)\s*[:=-]?\s*(\d[\d\s.,]*)/i,
    /(\d[\d\s.,]*)\s*(?:stk|st\.|pcs|pieces|x)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match || !match[1]) continue;
    const parsed = parseLocalizedNumber(match[1]);
    if (parsed == null) continue;
    const quantity = Math.round(parsed);
    if (quantity > 0) return quantity;
  }

  return null;
}

export function resolveTierMultiplier(dkkBase, tiers = DEFAULT_TIERS) {
  if (!Number.isFinite(dkkBase) || dkkBase <= 0) {
    throw new Error("dkkBase must be a positive number");
  }

  for (const tier of tiers) {
    if (tier.max_dkk_base == null) {
      return tier.multiplier;
    }
    if (dkkBase <= tier.max_dkk_base) {
      return tier.multiplier;
    }
  }

  return tiers[tiers.length - 1].multiplier;
}

export function roundToStep(value, step = 1) {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(step) || step <= 0) {
    throw new Error("rounding step must be > 0");
  }
  return Math.round(value / step) * step;
}

export function transformLiTextsToRows(liTexts, options) {
  const sourceRows = Array.isArray(liTexts) ? liTexts : [];
  const {
    eur_to_dkk,
    rounding_step,
    tiers,
    default_quantity_start,
    default_quantity_step,
  } = options;

  const skipped = [];
  const dedupeByQuantity = new Map();
  const usedQuantities = new Set();

  sourceRows.forEach((liText, index) => {
    const text = String(liText || "").trim();
    if (!text) {
      skipped.push({ index, reason: "empty_text" });
      return;
    }

    const eur = extractEurAmount(text);
    if (eur == null || eur <= 0) {
      skipped.push({ index, reason: "eur_not_found", li_text: text });
      return;
    }

    const parsedQuantity = extractQuantity(text);
    let quantity = parsedQuantity || (default_quantity_start + index * default_quantity_step);

    // Keep quantity unique for generic_product_prices unique key.
    while (usedQuantities.has(quantity)) {
      quantity += default_quantity_step;
    }
    usedQuantities.add(quantity);

    const dkkBase = eur * eur_to_dkk;
    const tierMultiplier = resolveTierMultiplier(dkkBase, tiers);
    const dkkFinal = roundToStep(dkkBase * tierMultiplier, rounding_step);

    dedupeByQuantity.set(quantity, {
      source_index: index,
      quantity,
      li_text: text,
      eur,
      dkk_base: Number(dkkBase.toFixed(4)),
      tier_multiplier: tierMultiplier,
      dkk_final: Math.round(dkkFinal),
    });
  });

  const rows = Array.from(dedupeByQuantity.values()).sort((a, b) => a.quantity - b.quantity);

  return {
    rows,
    skipped,
  };
}
