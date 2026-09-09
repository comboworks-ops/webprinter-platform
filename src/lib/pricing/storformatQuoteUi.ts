import type { StorformatConfig, StorformatTier } from '../../utils/storformatPricing';

type QuoteConfigFields = Pick<StorformatConfig, 'area_pricing_basis' | 'source_quote_model'>;

/** Preserve the supplier contract verbatim when projecting rows or saving templates. */
export function getStorformatSourceQuoteFields(input: unknown): QuoteConfigFields {
  if (!input || typeof input !== 'object') return {};
  const row = input as Record<string, unknown>;
  const fields: QuoteConfigFields = {};
  if (Object.prototype.hasOwnProperty.call(row, 'area_pricing_basis')) {
    fields.area_pricing_basis = row.area_pricing_basis as QuoteConfigFields['area_pricing_basis'];
  }
  if (Object.prototype.hasOwnProperty.call(row, 'source_quote_model')) fields.source_quote_model = row.source_quote_model;
  return fields;
}

export function normalizeStorformatAnchorState<T extends StorformatTier>(tiers: T[], preserve = false): T[] {
  const normalized = tiers.map(tier => ({ ...tier, is_anchor: Boolean(tier.is_anchor) }));
  const allAnchorsSelected = normalized.length > 0 && normalized.every(tier => tier.is_anchor);
  const allPointAnchors = normalized.every(tier => tier.to_m2 != null && Number(tier.from_m2) === Number(tier.to_m2));
  // Legacy intervals were all selected by default. Genuine point samples are intentional anchors.
  return !preserve && allAnchorsSelected && !allPointAnchors
    ? normalized.map(tier => ({ ...tier, is_anchor: false }))
    : normalized;
}

export function usesStorformatSourceQuotes(config: unknown): boolean {
  const fields = getStorformatSourceQuoteFields(config);
  return fields.area_pricing_basis === "per_piece_quotes" || fields.source_quote_model != null;
}

export function getStorformatQuoteCoverage(model: unknown) {
  const quantities = new Set<number>();
  const areas = new Set<number>();
  if (!model || typeof model !== 'object') return { quantities: [], areas: [], combinations: 0 };
  const combinations = (model as Record<string, unknown>).combinations;
  if (!Array.isArray(combinations)) return { quantities: [], areas: [], combinations: 0 };
  for (const combination of combinations) {
    if (!combination || !Array.isArray(combination.points)) continue;
    for (const point of combination.points) {
      if (Number.isInteger(point?.quantity) && point.quantity > 0) quantities.add(point.quantity);
      if (Number.isFinite(point?.area_m2) && point.area_m2 > 0) areas.add(point.area_m2);
    }
  }
  return {
    quantities: [...quantities].sort((a, b) => a - b),
    areas: [...areas].sort((a, b) => a - b),
    combinations: combinations.length,
  };
}

export const STORFORMAT_QUOTE_UNAVAILABLE_MESSAGE = 'Vi har endnu ikke en pris for dette format, antal og tilvalg. Vælg en anden kombination eller kontakt os for et tilbud.';
