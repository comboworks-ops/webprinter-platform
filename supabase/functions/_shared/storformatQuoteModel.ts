// Exact deployment-local mirror of src/utils/storformatQuoteModel.ts.
// BEGIN STOREFRONT QUOTE MODEL
/** Public retail prices only. Source files, supplier costs and extraction evidence stay in the import review. */
export type StorformatQuotePoint = { area_m2: number; quantity: number; total_price: number };
export type StorformatQuoteCombination = {
  material_id: string;
  finish_ids: string[];
  product_ids: string[];
  points: StorformatQuotePoint[];
};
export type StorformatSourceQuoteModel = {
  version: 1;
  currency: "DKK";
  price_basis: "regular";
  base_product_ids: string[];
  combinations: StorformatQuoteCombination[];
};
export type StorformatQuoteUnavailableReason = "model_invalid" | "selection_unavailable" | "area_unavailable" | "quantity_unavailable";

export class StorformatQuoteUnavailableError extends Error {
  readonly code = "storformat_quote_unavailable";
  readonly reason: StorformatQuoteUnavailableReason;
  constructor(reason: StorformatQuoteUnavailableReason = "model_invalid") {
    super(`storformat_quote_${reason}`);
    this.name = "StorformatQuoteUnavailableError";
    this.reason = reason;
  }
}

function unavailable(reason: StorformatQuoteUnavailableReason = "model_invalid"): never {
  throw new StorformatQuoteUnavailableError(reason);
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const validId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.trim() === value;
const ids = (value: unknown, reason: StorformatQuoteUnavailableReason = "model_invalid"): string[] => {
  // Version 1 describes Pixart's single finish and single production-speed choice.
  if (!Array.isArray(value) || value.length > 1 || value.some(id => !validId(id)) || new Set(value).size !== value.length) unavailable(reason);
  return [...value].sort();
};
const combinationKey = (materialId: string, finishIds: string[], productIds: string[]) => JSON.stringify([materialId, finishIds, productIds]);

/** Validate the entire payload before any quote is used; never fall back to legacy rates on malformed opt-in data. */
export function validateStorformatQuoteModel(value: unknown): StorformatSourceQuoteModel {
  if (!record(value) || value.version !== 1 || value.currency !== "DKK" || value.price_basis !== "regular"
    || !Array.isArray(value.combinations) || value.combinations.length === 0) unavailable();
  const baseProductIds = ids(value.base_product_ids);
  const combinationKeys = new Set<string>();
  const combinations = value.combinations.map((raw): StorformatQuoteCombination => {
    if (!record(raw) || !validId(raw.material_id) || !Array.isArray(raw.points) || raw.points.length === 0) unavailable();
    const finishIds = ids(raw.finish_ids), productIds = ids(raw.product_ids);
    const key = combinationKey(raw.material_id, finishIds, productIds);
    if (combinationKeys.has(key)) unavailable();
    combinationKeys.add(key);
    const pointKeys = new Map<string, StorformatQuotePoint>();
    for (const point of raw.points) {
      if (!record(point) || !positive(point.area_m2) || !positive(point.quantity)
        || !Number.isSafeInteger(point.quantity) || !positive(point.total_price)) unavailable();
      const pointKey = JSON.stringify([point.area_m2, point.quantity]);
      const previous = pointKeys.get(pointKey);
      if (previous && previous.total_price !== point.total_price) unavailable();
      pointKeys.set(pointKey, {area_m2: point.area_m2, quantity: point.quantity, total_price: point.total_price});
    }
    return {material_id: raw.material_id, finish_ids: finishIds, product_ids: productIds,
      points: [...pointKeys.values()].sort((a, b) => a.quantity - b.quantity || a.area_m2 - b.area_m2)};
  });
  return {version: 1, currency: "DKK", price_basis: "regular", base_product_ids: baseProductIds, combinations};
}

function quoteAtArea(combination: StorformatQuoteCombination, areaM2: number, quantity: number): number {
  const points = combination.points.filter(point => point.quantity === quantity);
  if (!points.length) unavailable("quantity_unavailable");
  // Tiny arithmetic noise from millimetre multiplication must not move an exact sampled point outside coverage.
  const tolerance = Number.EPSILON * 16 * Math.max(1, areaM2);
  const exact = points.find(point => Math.abs(point.area_m2 - areaM2) <= tolerance);
  if (exact) return exact.total_price;
  if (areaM2 < points[0].area_m2 || areaM2 > points[points.length - 1].area_m2) unavailable("area_unavailable");
  const upperIndex = points.findIndex(point => point.area_m2 > areaM2);
  if (upperIndex <= 0) unavailable("area_unavailable");
  const lower = points[upperIndex - 1], upper = points[upperIndex];
  const fraction = (areaM2 - lower.area_m2) / (upper.area_m2 - lower.area_m2);
  // Interpolate full order totals for this exact count. Do not interpolate a per-m² rate or the quantity axis.
  return lower.total_price + fraction * (upper.total_price - lower.total_price);
}

export function resolveStorformatSourceQuote(input: {
  model: unknown; materialId: unknown; finishIds: unknown; productIds: unknown; areaM2: number; quantity: number;
}): { baseTotal: number; finishedTotal: number; selectedTotal: number } {
  if (!positive(input.areaM2) || !positive(input.quantity) || !Number.isSafeInteger(input.quantity)) unavailable("selection_unavailable");
  if (!validId(input.materialId)) unavailable("selection_unavailable");
  const finishIds = ids(input.finishIds, "selection_unavailable"), productIds = ids(input.productIds, "selection_unavailable");
  const model = validateStorformatQuoteModel(input.model);
  const resolve = (finishes: string[], products: string[]) => {
    const key = combinationKey(input.materialId as string, finishes, products);
    const combination = model.combinations.find(row => combinationKey(row.material_id, row.finish_ids, row.product_ids) === key);
    if (!combination) unavailable("selection_unavailable");
    return quoteAtArea(combination, input.areaM2, input.quantity);
  };
  const baseTotal = resolve([], model.base_product_ids);
  const finishedTotal = resolve(finishIds, model.base_product_ids);
  const selectedTotal = resolve(finishIds, productIds);
  if (![baseTotal, finishedTotal, selectedTotal].every(positive)) unavailable();
  return {baseTotal, finishedTotal, selectedTotal};
}
