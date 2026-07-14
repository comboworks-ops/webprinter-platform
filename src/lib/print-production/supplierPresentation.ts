export type SupplierPresentationMode = "advanced" | "guided";

export interface SupplierPresentation {
  showPresets: boolean;
  showApiLimits: boolean;
  showRegionCurrency: boolean;
  showBatchToggle: boolean;
  matrixInitiallyExpanded: boolean;
  autoPublishDefault: boolean;
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
