import { calculateStorformatPrice } from "../../../utils/storformatPricing.ts";
import type { StorformatMaterial } from "../../../utils/storformatPricing.ts";

// Public demonstration values only. Never use these as shop prices or quotes.
export const LANDING_SAMPLE_MATERIALS = {
  banner: {
    name: "Banner",
    tiers: [{ from_m2: 0, price_per_m2: 120 }],
  },
  sign: {
    name: "Skilt",
    tiers: [{ from_m2: 0, price_per_m2: 180 }],
  },
} satisfies Record<string, StorformatMaterial>;

export type LandingCalculatorInput = {
  width: string;
  height: string;
  quantity: string;
  material: string;
};

export function parseExampleDimension(value: string): number | null {
  const trimmed = value.trim();
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(trimmed)) return null;
  const dimension = Number(trimmed.replace(",", "."));
  return Number.isFinite(dimension) && dimension > 0 && dimension <= 500
    ? dimension
    : null;
}

export function calculateLandingExample(input: LandingCalculatorInput) {
  const widthCm = parseExampleDimension(input.width);
  const heightCm = parseExampleDimension(input.height);
  const quantity = ["1", "5", "10"].includes(input.quantity)
    ? Number(input.quantity)
    : null;
  const material = Object.prototype.hasOwnProperty.call(LANDING_SAMPLE_MATERIALS, input.material)
    ? LANDING_SAMPLE_MATERIALS[input.material as keyof typeof LANDING_SAMPLE_MATERIALS]
    : null;
  const errors: Partial<Record<keyof LandingCalculatorInput, string>> = {};

  if (widthCm === null) errors.width = "Angiv en bredde over 0 og højst 500 cm.";
  if (heightCm === null) errors.height = "Angiv en højde over 0 og højst 500 cm.";
  if (quantity === null) errors.quantity = "Vælg 1, 5 eller 10 stk.";
  if (material === null) errors.material = "Vælg et materiale.";

  if (widthCm === null || heightCm === null || quantity === null || material === null) {
    return { errors, value: null };
  }

  const calculation = calculateStorformatPrice({
    widthMm: widthCm * 10,
    heightMm: heightCm * 10,
    quantity,
    material,
    config: { rounding_step: 1, global_markup_pct: 0, quantities: [1, 5, 10] },
  });

  return { errors, value: { ...calculation, widthCm, heightCm, quantity } };
}
