export type MachineMode = "SHEET" | "ROLL";

export interface MachineCostMachine {
  mode: MachineMode;
  sheet_width_mm?: number | null;
  sheet_height_mm?: number | null;
  roll_width_mm?: number | null;
  margin_left_mm?: number | null;
  margin_right_mm?: number | null;
  margin_top_mm?: number | null;
  margin_bottom_mm?: number | null;
  duplex_supported?: boolean | null;
  setup_waste_sheets?: number | null;
  run_waste_pct?: number | null;
  setup_time_min?: number | null;
  sheets_per_hour?: number | null;
  m2_per_hour?: number | null;
  machine_rate_per_hour?: number | null;
}

export interface MachineCostMaterial {
  pricing_mode: "PER_SHEET" | "PER_M2";
  price_per_sheet?: number | null;
  price_per_m2?: number | null;
  sheet_width_mm?: number | null;
  sheet_height_mm?: number | null;
}

export interface MachineCostInkSet {
  price_per_ml?: number | null;
  ml_per_m2_at_100pct?: number | null;
  default_coverage_pct?: number | null;
  tolerance_pct?: number | null;
}

export interface MachineCostJob {
  costModel: "INKJET" | "DIGITAL_CLICK" | "OFFSET";
  quantity: number;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  gapMm: number;
  sides: 1 | 2;
  coveragePct: number;
  targetMarginPct: number;
  roundingStep?: number;
  clickCostPerSide?: number;
  plateCount?: number;
  plateCostEach?: number;
  fixedJobCost?: number;
}

export interface MachineCostResult {
  mode: MachineMode;
  orientation: 0 | 90;
  columns: number;
  rows: number;
  itemsPerSheet: number;
  productionUnits: number;
  wasteUnits: number;
  totalUnits: number;
  consumedLengthM: number;
  mediaAreaM2: number;
  inkAreaM2: number;
  inkMl: number;
  runtimeMin: number;
  totalTimeMin: number;
  materialCost: number;
  inkCost: number;
  clickCost: number;
  plateCost: number;
  fixedJobCost: number;
  machineCost: number;
  baseCost: number;
  sellPrice: number;
  unitCost: number;
  unitPrice: number;
  profit: number;
  actualMarginPct: number;
  warnings: string[];
}

const numberOrZero = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fitCount = (available: number, item: number, gap: number) => {
  if (available <= 0 || item <= 0) return 0;
  return Math.max(0, Math.floor((available + gap) / (item + gap)));
};

const roundUp = (value: number, step: number) => {
  if (step <= 0) return value;
  return Math.ceil(value / step) * step;
};

export function simulateMachineCost(
  machine: MachineCostMachine,
  material: MachineCostMaterial,
  inkSet: MachineCostInkSet,
  job: MachineCostJob,
): MachineCostResult {
  const warnings: string[] = [];
  const quantity = Math.max(1, Math.floor(numberOrZero(job.quantity)));
  const bleed = Math.max(0, numberOrZero(job.bleedMm));
  const gap = Math.max(0, numberOrZero(job.gapMm));
  const itemWidth = Math.max(0, numberOrZero(job.widthMm)) + bleed * 2;
  const itemHeight = Math.max(0, numberOrZero(job.heightMm)) + bleed * 2;
  const sides = job.sides === 2 ? 2 : 1;
  const coverage = Math.min(100, Math.max(0, numberOrZero(job.coveragePct)));
  const tolerance = Math.max(0, numberOrZero(inkSet.tolerance_pct));
  const passFactor = sides === 2 && !machine.duplex_supported ? 2 : 1;

  const leftRight = numberOrZero(machine.margin_left_mm) + numberOrZero(machine.margin_right_mm);
  const topBottom = numberOrZero(machine.margin_top_mm) + numberOrZero(machine.margin_bottom_mm);

  let orientation: 0 | 90 = 0;
  let columns = 0;
  let rows = 1;
  let itemsPerSheet = 0;
  let productionUnits = 0;
  let wasteUnits = 0;
  let totalUnits = 0;
  let consumedLengthM = 0;
  let mediaAreaM2 = 0;
  let runtimeMin = 0;

  if (machine.mode === "SHEET") {
    const sheetWidth = numberOrZero(machine.sheet_width_mm);
    const sheetHeight = numberOrZero(machine.sheet_height_mm);
    const printableWidth = Math.max(0, sheetWidth - leftRight);
    const printableHeight = Math.max(0, sheetHeight - topBottom);

    const normalCols = fitCount(printableWidth, itemWidth, gap);
    const normalRows = fitCount(printableHeight, itemHeight, gap);
    const rotatedCols = fitCount(printableWidth, itemHeight, gap);
    const rotatedRows = fitCount(printableHeight, itemWidth, gap);
    const normalUps = normalCols * normalRows;
    const rotatedUps = rotatedCols * rotatedRows;

    if (rotatedUps > normalUps) {
      orientation = 90;
      columns = rotatedCols;
      rows = rotatedRows;
      itemsPerSheet = rotatedUps;
    } else {
      columns = normalCols;
      rows = normalRows;
      itemsPerSheet = normalUps;
    }

    if (itemsPerSheet <= 0) warnings.push("Formatet kan ikke være på maskinens printbare ark.");
    productionUnits = itemsPerSheet > 0 ? Math.ceil(quantity / itemsPerSheet) : 0;
    wasteUnits = Math.max(0, Math.ceil(numberOrZero(machine.setup_waste_sheets)))
      + Math.ceil(productionUnits * Math.max(0, numberOrZero(machine.run_waste_pct)) / 100);
    totalUnits = productionUnits + wasteUnits;
    mediaAreaM2 = totalUnits * sheetWidth * sheetHeight / 1_000_000;

    const speed = numberOrZero(machine.sheets_per_hour);
    if (speed > 0) runtimeMin = totalUnits / speed * 60 * passFactor;
    else warnings.push("Maskinens realistiske ark-hastighed mangler.");
  } else {
    const rollWidth = numberOrZero(machine.roll_width_mm);
    const printableWidth = Math.max(0, rollWidth - leftRight);
    const normalColumns = fitCount(printableWidth, itemWidth, gap);
    const rotatedColumns = fitCount(printableWidth, itemHeight, gap);

    const normalRowsNeeded = normalColumns > 0 ? Math.ceil(quantity / normalColumns) : Number.POSITIVE_INFINITY;
    const rotatedRowsNeeded = rotatedColumns > 0 ? Math.ceil(quantity / rotatedColumns) : Number.POSITIVE_INFINITY;
    const normalLength = normalRowsNeeded * (itemHeight + gap) - gap;
    const rotatedLength = rotatedRowsNeeded * (itemWidth + gap) - gap;

    if (rotatedLength < normalLength) {
      orientation = 90;
      columns = rotatedColumns;
      rows = Number.isFinite(rotatedRowsNeeded) ? rotatedRowsNeeded : 0;
      consumedLengthM = Math.max(0, rotatedLength) / 1000;
    } else {
      columns = normalColumns;
      rows = Number.isFinite(normalRowsNeeded) ? normalRowsNeeded : 0;
      consumedLengthM = Math.max(0, normalLength) / 1000;
    }

    itemsPerSheet = columns;
    if (columns <= 0) warnings.push("Formatet er bredere end maskinens printbare rullebredde.");
    productionUnits = rows;
    const setupRows = Math.max(0, Math.ceil(numberOrZero(machine.setup_waste_sheets)));
    const runWasteRows = Math.ceil(productionUnits * Math.max(0, numberOrZero(machine.run_waste_pct)) / 100);
    wasteUnits = setupRows + runWasteRows;
    totalUnits = productionUnits + wasteUnits;
    const itemLength = orientation === 90 ? itemWidth : itemHeight;
    consumedLengthM = columns > 0
      ? Math.max(0, totalUnits * (itemLength + gap) - gap) / 1000
      : 0;
    mediaAreaM2 = rollWidth / 1000 * consumedLengthM;

    const speed = numberOrZero(machine.m2_per_hour);
    if (speed > 0) runtimeMin = mediaAreaM2 / speed * 60 * passFactor;
    else warnings.push("Maskinens målte m²-hastighed mangler for den valgte kvalitet.");
  }

  let materialCost = 0;
  if (material.pricing_mode === "PER_SHEET") {
    materialCost = totalUnits * numberOrZero(material.price_per_sheet);
  } else {
    materialCost = mediaAreaM2 * numberOrZero(material.price_per_m2);
  }

  if (materialCost <= 0) warnings.push("Materialeprisen er 0 kr.; kostprisen er derfor ufuldstændig.");

  const useAreaInk = job.costModel !== "DIGITAL_CLICK";
  const inkAreaM2 = quantity * sides * itemWidth * itemHeight / 1_000_000;
  const inkMl = useAreaInk
    ? inkAreaM2 * numberOrZero(inkSet.ml_per_m2_at_100pct) * coverage / 100 * (1 + tolerance / 100)
    : 0;
  const inkCost = useAreaInk ? inkMl * numberOrZero(inkSet.price_per_ml) : 0;
  if (useAreaInk && (numberOrZero(inkSet.price_per_ml) <= 0 || numberOrZero(inkSet.ml_per_m2_at_100pct) <= 0)) {
    warnings.push("Blækpris eller målt blækforbrug mangler.");
  }

  const clickCost = job.costModel === "DIGITAL_CLICK"
    ? totalUnits * sides * Math.max(0, numberOrZero(job.clickCostPerSide))
    : 0;
  if (job.costModel === "DIGITAL_CLICK" && numberOrZero(job.clickCostPerSide) <= 0) {
    warnings.push("Klikpris pr. trykt side mangler.");
  }

  const plateCost = job.costModel === "OFFSET"
    ? Math.max(0, Math.floor(numberOrZero(job.plateCount))) * Math.max(0, numberOrZero(job.plateCostEach))
    : 0;
  const fixedJobCost = job.costModel === "OFFSET" ? Math.max(0, numberOrZero(job.fixedJobCost)) : 0;
  if (job.costModel === "OFFSET" && plateCost <= 0) warnings.push("Pladeantal eller pladepris mangler for offsetjobbet.");

  const totalTimeMin = Math.max(0, numberOrZero(machine.setup_time_min)) + runtimeMin;
  const machineRate = numberOrZero(machine.machine_rate_per_hour);
  const machineCost = totalTimeMin / 60 * machineRate;
  if (machineRate <= 0) warnings.push("Maskinens timekost er 0 kr.; finansiering, service og arbejdsløn er ikke medregnet.");

  const baseCost = materialCost + inkCost + clickCost + plateCost + fixedJobCost + machineCost;
  const targetMargin = Math.min(95, Math.max(0, numberOrZero(job.targetMarginPct)));
  const rawSellPrice = targetMargin > 0 ? baseCost / (1 - targetMargin / 100) : baseCost;
  const sellPrice = roundUp(rawSellPrice, Math.max(0, numberOrZero(job.roundingStep)));
  const profit = sellPrice - baseCost;

  return {
    mode: machine.mode,
    orientation,
    columns,
    rows,
    itemsPerSheet,
    productionUnits,
    wasteUnits,
    totalUnits,
    consumedLengthM,
    mediaAreaM2,
    inkAreaM2,
    inkMl,
    runtimeMin,
    totalTimeMin,
    materialCost,
    inkCost,
    clickCost,
    plateCost,
    fixedJobCost,
    machineCost,
    baseCost,
    sellPrice,
    unitCost: baseCost / quantity,
    unitPrice: sellPrice / quantity,
    profit,
    actualMarginPct: sellPrice > 0 ? profit / sellPrice * 100 : 0,
    warnings,
  };
}
