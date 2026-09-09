type LegacyMatrixPriceRecalculationInput = {
  hasSelectedCell: boolean;
  isStorformat: boolean;
  pricingMode?: string | null;
};

export function shouldRunLegacyMatrixPriceRecalculation({
  hasSelectedCell,
  isStorformat,
  pricingMode,
}: LegacyMatrixPriceRecalculationInput): boolean {
  return hasSelectedCell && !isStorformat && pricingMode !== "matrix_layout_v1";
}
