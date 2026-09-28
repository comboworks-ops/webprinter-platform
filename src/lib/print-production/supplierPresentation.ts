export type SupplierPresentationMode = "advanced" | "guided";

export interface SupplierPresentation {
  showPresets: boolean;
  showApiLimits: boolean;
  showRegionCurrency: boolean;
  showBatchToggle: boolean;
  matrixInitiallyExpanded: boolean;
  autoPublishDefault: boolean;
}

export interface SupplierPricingMatrixRow {
  needs_quote?: boolean | null;
  quantities?: readonly unknown[] | null;
  base_costs?: readonly unknown[] | null;
  recommended_retail?: readonly unknown[] | null;
}

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === "number" && Number.isFinite(value)
);

export function isSupplierPricingComplete(
  rows: readonly SupplierPricingMatrixRow[] | null | undefined,
): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return false;

  return rows.every((row) => {
    const quantities = row.quantities;
    const baseCosts = row.base_costs;
    const recommendedRetail = row.recommended_retail;

    if (row.needs_quote !== false) return false;
    if (!Array.isArray(quantities) || quantities.length === 0) return false;
    if (!Array.isArray(baseCosts) || baseCosts.length !== quantities.length) return false;
    if (!Array.isArray(recommendedRetail) || recommendedRetail.length !== quantities.length) return false;

    return quantities.every(isFiniteNumber)
      && baseCosts.every(isFiniteNumber)
      && recommendedRetail.every(isFiniteNumber);
  });
}

export function getSupplierPresentation(
  mode: SupplierPresentationMode,
): SupplierPresentation {
  switch (mode) {
    case "guided":
      return {
        showPresets: false,
        showApiLimits: false,
        showRegionCurrency: false,
        showBatchToggle: false,
        matrixInitiallyExpanded: false,
        autoPublishDefault: true,
      };
    case "advanced":
      return {
        showPresets: true,
        showApiLimits: true,
        showRegionCurrency: true,
        showBatchToggle: true,
        matrixInitiallyExpanded: true,
        autoPublishDefault: false,
      };
    default: {
      const exhaustiveMode: never = mode;
      return exhaustiveMode;
    }
  }
}
