import { simulateMachineCost, type MachineCostMachine } from "./machineCostSimulator.ts";

export type MachineDraftTest = {
  widthMm: number;
  heightMm: number;
  quantity: number;
  bleedMm: number;
  gapMm: number;
  cuttingMinutes: number;
  cuttingRatePerHour: number;
};

const nonNegative = (value: unknown) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);

/** Draft-only machine share. The saved pricing calculators and records are unchanged. */
export function estimateMachineDraft(machine: MachineCostMachine, test: MachineDraftTest) {
  const quantity = Math.floor(nonNegative(test.quantity));
  const draftMachine = { ...machine };
  const invalidFields: string[] = [];
  for (const key of ["margin_left_mm", "margin_right_mm", "margin_top_mm", "margin_bottom_mm", "setup_waste_sheets", "run_waste_pct", "setup_time_min"] as const) {
    if (Number(machine[key]) < 0 || (machine[key] != null && !Number.isFinite(Number(machine[key])))) invalidFields.push(key);
    draftMachine[key] = nonNegative(machine[key]);
  }
  const result = simulateMachineCost(
    draftMachine,
    { pricing_mode: "PER_M2", price_per_m2: 0 },
    {},
    {
      costModel: "DIGITAL_CLICK", quantity,
      widthMm: test.widthMm, heightMm: test.heightMm,
      bleedMm: test.bleedMm, gapMm: test.gapMm,
      sides: 1, coveragePct: 0, targetMarginPct: 0, clickCostPerSide: 0,
    },
  );
  const missing: string[] = [];
  if (invalidFields.length > 0) missing.push("maskindata på 0 eller derover");
  if ([test.bleedMm, test.gapMm, test.cuttingMinutes, test.cuttingRatePerHour].some(value => !Number.isFinite(value) || value < 0)) missing.push("testværdier på 0 eller derover");
  const width = machine.mode === "SHEET" ? machine.sheet_width_mm : machine.roll_width_mm;
  if (nonNegative(width) <= 0 || (machine.mode === "SHEET" && nonNegative(machine.sheet_height_mm) <= 0)) {
    missing.push(machine.mode === "SHEET" ? "arkets bredde og højde" : "rullebredde");
  } else if (result.itemsPerSheet <= 0) {
    missing.push("plads til det valgte format");
  }
  if (quantity <= 0 || !Number.isInteger(test.quantity)) missing.push("et helt antal større end 0");
  const speed = machine.mode === "SHEET" ? machine.sheets_per_hour : machine.m2_per_hour;
  if (nonNegative(speed) <= 0) missing.push(machine.mode === "SHEET" ? "ark i timen" : "m² i timen");
  if (nonNegative(machine.machine_rate_per_hour) <= 0) missing.push("maskinens timepris");
  const cuttingMinutes = nonNegative(test.cuttingMinutes);
  const cuttingRate = nonNegative(test.cuttingRatePerHour);
  if (cuttingMinutes > 0 && cuttingRate <= 0) missing.push("timepris for skæring");
  const cuttingCost = cuttingMinutes / 60 * cuttingRate;
  const ready = missing.length === 0;
  return {
    result, missing, ready, cuttingCost,
    totalCost: ready ? result.machineCost + cuttingCost : null,
    unitCost: ready ? (result.machineCost + cuttingCost) / quantity : null,
  };
}
