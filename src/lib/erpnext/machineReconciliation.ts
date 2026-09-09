import type { MachineCostResult } from "../pricing/machineCostSimulator.ts";
import type {
  ErpShadowProductionOrderInput,
} from "./shadowContract.ts";

export type ErpMaterialUnit =
  | "sheet"
  | "meter"
  | "square_meter"
  | "kilogram"
  | "liter"
  | "piece"
  | "roll";

export interface MachineReconciliationInput {
  sourceOrderItemId: string;
  sourceProductId: string;
  title: string;
  quantity: number;
  unitSellingPrice: number;
  selectedOptions?: Record<string, string>;
  productionRecipeRef?: string;
  machineProfileRef: string;
  primaryMaterialRef: string;
  primaryMaterialUnit: Extract<
    ErpMaterialUnit,
    "sheet" | "meter" | "square_meter"
  >;
  calculation: MachineCostResult;
}

/**
 * Converts an already-reviewed Webprinter machine calculation into the
 * shadow-only ERP contract. The calculation remains authoritative in
 * Webprinter; this adapter only exposes proposed operational quantities for
 * reconciliation and never posts stock or accounting entries.
 */
export function reconcileMachineCalculation(
  input: MachineReconciliationInput,
): ErpShadowProductionOrderInput["lines"][number] {
  const materialQuantity = (() => {
    if (input.primaryMaterialUnit === "sheet") {
      return input.calculation.totalUnits;
    }
    if (input.primaryMaterialUnit === "meter") {
      return input.calculation.consumedLengthM;
    }
    return input.calculation.mediaAreaM2;
  })();

  if (!Number.isFinite(materialQuantity) || materialQuantity <= 0) {
    throw new Error(
      "The machine calculation must produce a positive material quantity",
    );
  }
  if (
    !Number.isFinite(input.calculation.totalTimeMin) ||
    input.calculation.totalTimeMin < 0
  ) {
    throw new Error("The machine calculation produced invalid machine time");
  }

  return {
    sourceOrderItemId: input.sourceOrderItemId,
    sourceProductId: input.sourceProductId,
    title: input.title,
    quantity: input.quantity,
    unitSellingPrice: input.unitSellingPrice,
    selectedOptions: input.selectedOptions ?? {},
    productionRecipeRef: input.productionRecipeRef,
    machineProfileRef: input.machineProfileRef,
    estimatedRunMinutes: input.calculation.totalTimeMin,
    materialRequirements: [
      {
        materialRef: input.primaryMaterialRef,
        quantity: materialQuantity,
        unit: input.primaryMaterialUnit,
      },
    ],
  };
}
