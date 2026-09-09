import { MaxRectsPacker, Rectangle } from "maxrects-packer";

import type {
  MachineCostInkSet,
  MachineCostJob,
  MachineCostMachine,
  MachineCostMaterial,
} from "./machineCostSimulator";

export interface JobPoolDraft {
  id: string;
  name: string;
  quantity: number;
  widthMm: number;
  heightMm: number;
  allowRotation?: boolean;
}

export interface JobPoolSettings {
  costModel: MachineCostJob["costModel"];
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

export interface JobPoolPlacement {
  jobId: string;
  slotIndex: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotated: boolean;
}

export interface JobPoolFormJob {
  jobId: string;
  name: string;
  requestedQuantity: number;
  slotsPerSheet: number;
  plannedQuantity: number;
  overrunQuantity: number;
}

export interface JobPoolCostBreakdown {
  materialCost: number;
  inkCost: number;
  clickCost: number;
  plateCost: number;
  fixedJobCost: number;
  machineCost: number;
  baseCost: number;
  sellPrice: number;
  totalTimeMin: number;
}

export interface JobPoolForm {
  id: string;
  jobs: JobPoolFormJob[];
  placements: JobPoolPlacement[];
  sheetWidthMm: number;
  sheetHeightMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
  netSheets: number;
  wasteSheets: number;
  totalSheets: number;
  utilizationPct: number;
  cost: JobPoolCostBreakdown;
  slotLimitReached: boolean;
}

export interface JobPoolPlan {
  status: "ready" | "blocked";
  recommendation: "pool" | "separate" | "review";
  forms: JobPoolForm[];
  errors: string[];
  warnings: string[];
  pooledCost: number;
  standaloneCost: number;
  estimatedSavings: number;
  estimatedSavingsPct: number;
  pooledSellPrice: number;
  netSheets: number;
  totalSheets: number;
  standaloneTotalSheets: number;
  materialSheetsSaved: number;
  setupMinutesSaved: number;
}

type SheetGeometry = {
  sheetWidthMm: number;
  sheetHeightMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
};

type PackedSlotData = {
  jobId: string;
  slotIndex: number;
  allowRotation: boolean;
};

type PackedForm = {
  bins: MaxRectsPacker<Rectangle>["bins"];
  oversizedJobIds: string[];
};

const MAX_FORM_SLOTS = 180;

const numberOrZero = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundUp = (value: number, step: number) => {
  if (step <= 0) return value;
  return Math.ceil(value / step) * step;
};

const unique = (values: string[]) => [...new Set(values)];

function resolveSheetGeometry(
  machine: MachineCostMachine,
  material: MachineCostMaterial,
): { geometry: SheetGeometry | null; warnings: string[]; error?: string } {
  if (machine.mode !== "SHEET") {
    return {
      geometry: null,
      warnings: [],
      error: "Sammelform-piloten understøtter endnu kun arkmaskiner.",
    };
  }

  const machineWidth = numberOrZero(machine.sheet_width_mm);
  const machineHeight = numberOrZero(machine.sheet_height_mm);
  if (machineWidth <= 0 || machineHeight <= 0) {
    return {
      geometry: null,
      warnings: [],
      error: "Maskinens arkformat mangler.",
    };
  }

  const warnings: string[] = [];
  const materialWidth = numberOrZero(material.sheet_width_mm);
  const materialHeight = numberOrZero(material.sheet_height_mm);
  const leftRight = numberOrZero(machine.margin_left_mm) + numberOrZero(machine.margin_right_mm);
  const topBottom = numberOrZero(machine.margin_top_mm) + numberOrZero(machine.margin_bottom_mm);

  const candidates = materialWidth > 0 && materialHeight > 0
    ? [
        { width: materialWidth, height: materialHeight },
        { width: materialHeight, height: materialWidth },
      ].filter(({ width, height }) => width <= machineWidth && height <= machineHeight)
    : [{ width: machineWidth, height: machineHeight }];

  if (materialWidth <= 0 || materialHeight <= 0) {
    warnings.push("Materialets råark mangler; planen bruger maskinens arkformat.");
  }

  if (candidates.length === 0) {
    return {
      geometry: null,
      warnings,
      error: "Det valgte råark kan ikke være på maskinen, heller ikke roteret.",
    };
  }

  const best = candidates
    .map((candidate) => ({
      ...candidate,
      printableArea: Math.max(0, candidate.width - leftRight) * Math.max(0, candidate.height - topBottom),
    }))
    .sort((a, b) => b.printableArea - a.printableArea)[0];

  const printableWidthMm = best.width - leftRight;
  const printableHeightMm = best.height - topBottom;
  if (printableWidthMm <= 0 || printableHeightMm <= 0) {
    return {
      geometry: null,
      warnings,
      error: "Maskinens sikkerhedsmarginer efterlader intet printbart arkareal.",
    };
  }

  return {
    geometry: {
      sheetWidthMm: best.width,
      sheetHeightMm: best.height,
      printableWidthMm,
      printableHeightMm,
    },
    warnings,
  };
}

function createRectangle(job: JobPoolDraft, slotIndex: number, settings: JobPoolSettings) {
  const bleed = Math.max(0, numberOrZero(settings.bleedMm));
  const rectangle = new Rectangle(
    numberOrZero(job.widthMm) + bleed * 2,
    numberOrZero(job.heightMm) + bleed * 2,
    0,
    0,
    false,
    job.allowRotation !== false,
  );
  rectangle.data = {
    jobId: job.id,
    slotIndex,
    allowRotation: job.allowRotation !== false,
  } satisfies PackedSlotData;
  return rectangle;
}

function packSlots(
  jobs: JobPoolDraft[],
  slotCounts: Map<string, number>,
  geometry: SheetGeometry,
  settings: JobPoolSettings,
): PackedForm {
  const rectangles = jobs.flatMap((job) => Array.from(
    { length: slotCounts.get(job.id) ?? 0 },
    (_, slotIndex) => createRectangle(job, slotIndex, settings),
  ));
  const packer = new MaxRectsPacker<Rectangle>(
    geometry.printableWidthMm,
    geometry.printableHeightMm,
    Math.max(0, numberOrZero(settings.gapMm)),
    {
      smart: false,
      pot: false,
      square: false,
      allowRotation: true,
      border: 0,
    },
  );
  packer.addArray(rectangles);

  return {
    bins: packer.bins,
    oversizedJobIds: unique(
      rectangles
        .filter((rectangle) => rectangle.oversized)
        .map((rectangle) => (rectangle.data as PackedSlotData).jobId),
    ),
  };
}

function completionSheets(job: JobPoolDraft, slotCount: number) {
  return Math.ceil(job.quantity / Math.max(1, slotCount));
}

function totalOverrun(jobs: JobPoolDraft[], slotCounts: Map<string, number>) {
  const runSheets = Math.max(...jobs.map((job) => completionSheets(job, slotCounts.get(job.id) ?? 1)));
  return jobs.reduce(
    (sum, job) => sum + Math.max(0, runSheets * (slotCounts.get(job.id) ?? 1) - job.quantity),
    0,
  );
}

function optimizeFormSlots(
  jobs: JobPoolDraft[],
  geometry: SheetGeometry,
  settings: JobPoolSettings,
) {
  let slotCounts = new Map(jobs.map((job) => [job.id, 1]));
  let packed = packSlots(jobs, slotCounts, geometry, settings);
  let slotLimitReached = false;

  if (packed.bins.length !== 1 || packed.oversizedJobIds.length > 0) {
    return { slotCounts, packed, slotLimitReached };
  }

  while ([...slotCounts.values()].reduce((sum, value) => sum + value, 0) < MAX_FORM_SLOTS) {
    const currentRunSheets = Math.max(
      ...jobs.map((job) => completionSheets(job, slotCounts.get(job.id) ?? 1)),
    );
    if (currentRunSheets <= 1) break;

    const candidates = jobs
      .filter((job) => completionSheets(job, slotCounts.get(job.id) ?? 1) === currentRunSheets)
      .filter((job) => (slotCounts.get(job.id) ?? 1) < job.quantity);

    let best: {
      slotCounts: Map<string, number>;
      packed: PackedForm;
      runSheets: number;
      overrun: number;
      pressure: number;
    } | null = null;

    for (const candidate of candidates) {
      const trialCounts = new Map(slotCounts);
      trialCounts.set(candidate.id, (trialCounts.get(candidate.id) ?? 1) + 1);
      const trialPacked = packSlots(jobs, trialCounts, geometry, settings);
      if (trialPacked.bins.length !== 1 || trialPacked.oversizedJobIds.length > 0) continue;

      const runSheets = Math.max(
        ...jobs.map((job) => completionSheets(job, trialCounts.get(job.id) ?? 1)),
      );
      const trial = {
        slotCounts: trialCounts,
        packed: trialPacked,
        runSheets,
        overrun: totalOverrun(jobs, trialCounts),
        pressure: candidate.quantity / (trialCounts.get(candidate.id) ?? 1),
      };

      if (
        !best
        || trial.runSheets < best.runSheets
        || (trial.runSheets === best.runSheets && trial.overrun < best.overrun)
        || (trial.runSheets === best.runSheets && trial.overrun === best.overrun && trial.pressure > best.pressure)
      ) {
        best = trial;
      }
    }

    if (!best) break;
    slotCounts = best.slotCounts;
    packed = best.packed;
  }

  if ([...slotCounts.values()].reduce((sum, value) => sum + value, 0) >= MAX_FORM_SLOTS) {
    slotLimitReached = true;
  }

  return { slotCounts, packed, slotLimitReached };
}

function buildFormCost(
  jobs: JobPoolDraft[],
  slotCounts: Map<string, number>,
  runSheets: number,
  geometry: SheetGeometry,
  machine: MachineCostMachine,
  material: MachineCostMaterial,
  inkSet: MachineCostInkSet,
  settings: JobPoolSettings,
): { cost: JobPoolCostBreakdown; wasteSheets: number; totalSheets: number } {
  const setupWasteSheets = Math.max(0, Math.ceil(numberOrZero(machine.setup_waste_sheets)));
  const runWasteSheets = Math.ceil(runSheets * Math.max(0, numberOrZero(machine.run_waste_pct)) / 100);
  const wasteSheets = setupWasteSheets + runWasteSheets;
  const totalSheets = runSheets + wasteSheets;
  const sheetAreaM2 = geometry.sheetWidthMm * geometry.sheetHeightMm / 1_000_000;
  const materialCost = material.pricing_mode === "PER_SHEET"
    ? totalSheets * numberOrZero(material.price_per_sheet)
    : totalSheets * sheetAreaM2 * numberOrZero(material.price_per_m2);

  const sides = settings.sides === 2 ? 2 : 1;
  const bleed = Math.max(0, numberOrZero(settings.bleedMm));
  const printedAreaM2 = jobs.reduce((area, job) => {
    const slots = slotCounts.get(job.id) ?? 1;
    const producedQuantity = slots * runSheets;
    const itemArea = (job.widthMm + bleed * 2) * (job.heightMm + bleed * 2) / 1_000_000;
    return area + producedQuantity * sides * itemArea;
  }, 0);
  const coverage = Math.min(100, Math.max(0, numberOrZero(settings.coveragePct)));
  const tolerance = Math.max(0, numberOrZero(inkSet.tolerance_pct));
  const usesAreaInk = settings.costModel !== "DIGITAL_CLICK";
  const inkMl = usesAreaInk
    ? printedAreaM2 * numberOrZero(inkSet.ml_per_m2_at_100pct) * coverage / 100 * (1 + tolerance / 100)
    : 0;
  const inkCost = usesAreaInk ? inkMl * numberOrZero(inkSet.price_per_ml) : 0;
  const clickCost = settings.costModel === "DIGITAL_CLICK"
    ? totalSheets * sides * Math.max(0, numberOrZero(settings.clickCostPerSide))
    : 0;
  const plateCost = settings.costModel === "OFFSET"
    ? Math.max(0, Math.floor(numberOrZero(settings.plateCount))) * Math.max(0, numberOrZero(settings.plateCostEach))
    : 0;
  const fixedJobCost = settings.costModel === "OFFSET"
    ? Math.max(0, numberOrZero(settings.fixedJobCost))
    : 0;

  const passFactor = sides === 2 && !machine.duplex_supported ? 2 : 1;
  const speed = numberOrZero(machine.sheets_per_hour);
  const runtimeMin = speed > 0 ? totalSheets / speed * 60 * passFactor : 0;
  const totalTimeMin = Math.max(0, numberOrZero(machine.setup_time_min)) + runtimeMin;
  const machineCost = totalTimeMin / 60 * numberOrZero(machine.machine_rate_per_hour);
  const baseCost = materialCost + inkCost + clickCost + plateCost + fixedJobCost + machineCost;
  const targetMargin = Math.min(95, Math.max(0, numberOrZero(settings.targetMarginPct)));
  const rawSellPrice = targetMargin > 0 ? baseCost / (1 - targetMargin / 100) : baseCost;

  return {
    wasteSheets,
    totalSheets,
    cost: {
      materialCost,
      inkCost,
      clickCost,
      plateCost,
      fixedJobCost,
      machineCost,
      baseCost,
      sellPrice: roundUp(rawSellPrice, Math.max(0, numberOrZero(settings.roundingStep))),
      totalTimeMin,
    },
  };
}

function buildForm(
  id: string,
  jobs: JobPoolDraft[],
  geometry: SheetGeometry,
  machine: MachineCostMachine,
  material: MachineCostMaterial,
  inkSet: MachineCostInkSet,
  settings: JobPoolSettings,
): JobPoolForm | null {
  const optimized = optimizeFormSlots(jobs, geometry, settings);
  if (optimized.packed.bins.length !== 1 || optimized.packed.oversizedJobIds.length > 0) return null;

  const runSheets = Math.max(
    ...jobs.map((job) => completionSheets(job, optimized.slotCounts.get(job.id) ?? 1)),
  );
  const costResult = buildFormCost(
    jobs,
    optimized.slotCounts,
    runSheets,
    geometry,
    machine,
    material,
    inkSet,
    settings,
  );
  const bin = optimized.packed.bins[0];
  const placements = bin.rects.map((rectangle) => {
    const data = rectangle.data as PackedSlotData;
    return {
      jobId: data.jobId,
      slotIndex: data.slotIndex,
      xMm: rectangle.x,
      yMm: rectangle.y,
      widthMm: rectangle.width,
      heightMm: rectangle.height,
      rotated: rectangle.rot,
    } satisfies JobPoolPlacement;
  });
  const occupiedArea = placements.reduce((sum, placement) => sum + placement.widthMm * placement.heightMm, 0);
  const printableArea = geometry.printableWidthMm * geometry.printableHeightMm;

  return {
    id,
    placements,
    sheetWidthMm: geometry.sheetWidthMm,
    sheetHeightMm: geometry.sheetHeightMm,
    printableWidthMm: geometry.printableWidthMm,
    printableHeightMm: geometry.printableHeightMm,
    netSheets: runSheets,
    wasteSheets: costResult.wasteSheets,
    totalSheets: costResult.totalSheets,
    utilizationPct: printableArea > 0 ? occupiedArea / printableArea * 100 : 0,
    cost: costResult.cost,
    slotLimitReached: optimized.slotLimitReached,
    jobs: jobs.map((job) => {
      const slotsPerSheet = optimized.slotCounts.get(job.id) ?? 1;
      const plannedQuantity = slotsPerSheet * runSheets;
      return {
        jobId: job.id,
        name: job.name,
        requestedQuantity: job.quantity,
        slotsPerSheet,
        plannedQuantity,
        overrunQuantity: Math.max(0, plannedQuantity - job.quantity),
      };
    }),
  };
}

function costWarnings(
  machine: MachineCostMachine,
  material: MachineCostMaterial,
  inkSet: MachineCostInkSet,
  settings: JobPoolSettings,
) {
  const warnings: string[] = [];
  if (numberOrZero(machine.sheets_per_hour) <= 0) warnings.push("Maskinens målte ark-hastighed mangler.");
  if (numberOrZero(machine.machine_rate_per_hour) <= 0) warnings.push("Maskinens timekost er 0 kr.");
  if (
    (material.pricing_mode === "PER_SHEET" && numberOrZero(material.price_per_sheet) <= 0)
    || (material.pricing_mode === "PER_M2" && numberOrZero(material.price_per_m2) <= 0)
  ) {
    warnings.push("Materialeprisen mangler.");
  }
  if (settings.costModel === "DIGITAL_CLICK" && numberOrZero(settings.clickCostPerSide) <= 0) {
    warnings.push("Klikpris pr. side mangler.");
  }
  if (
    settings.costModel !== "DIGITAL_CLICK"
    && (numberOrZero(inkSet.price_per_ml) <= 0 || numberOrZero(inkSet.ml_per_m2_at_100pct) <= 0)
  ) {
    warnings.push("Blækpris eller målt blækforbrug mangler.");
  }
  if (settings.costModel === "OFFSET") {
    warnings.push("Offset-sammelformen kræver manuel kontrol af plader, farver, skæremærker og efterbehandling.");
    if (numberOrZero(settings.plateCount) <= 0 || numberOrZero(settings.plateCostEach) <= 0) {
      warnings.push("Pladeantal eller pladepris mangler.");
    }
  }
  return warnings;
}

export function planJobPool(
  machine: MachineCostMachine,
  material: MachineCostMaterial,
  inkSet: MachineCostInkSet,
  jobs: JobPoolDraft[],
  settings: JobPoolSettings,
): JobPoolPlan {
  const errors: string[] = [];
  const normalizedJobs = jobs.map((job) => ({
    ...job,
    name: job.name.trim() || "Job uden navn",
    quantity: Math.floor(numberOrZero(job.quantity)),
    widthMm: numberOrZero(job.widthMm),
    heightMm: numberOrZero(job.heightMm),
  }));

  if (normalizedJobs.length === 0) errors.push("Tilføj mindst ét job til puljen.");
  if (new Set(normalizedJobs.map((job) => job.id)).size !== normalizedJobs.length) {
    errors.push("Jobpuljen indeholder dublerede job-id'er.");
  }
  for (const job of normalizedJobs) {
    if (job.quantity <= 0) errors.push(`${job.name}: antal skal være større end 0.`);
    if (job.widthMm <= 0 || job.heightMm <= 0) errors.push(`${job.name}: formatet mangler.`);
  }

  const sheet = resolveSheetGeometry(machine, material);
  if (sheet.error) errors.push(sheet.error);
  if (errors.length > 0 || !sheet.geometry) {
    return {
      status: "blocked",
      recommendation: "review",
      forms: [],
      errors: unique(errors),
      warnings: sheet.warnings,
      pooledCost: 0,
      standaloneCost: 0,
      estimatedSavings: 0,
      estimatedSavingsPct: 0,
      pooledSellPrice: 0,
      netSheets: 0,
      totalSheets: 0,
      standaloneTotalSheets: 0,
      materialSheetsSaved: 0,
      setupMinutesSaved: 0,
    };
  }

  const seedSlots = new Map(normalizedJobs.map((job) => [job.id, 1]));
  const seeded = packSlots(normalizedJobs, seedSlots, sheet.geometry, settings);
  if (seeded.oversizedJobIds.length > 0) {
    const oversizedNames = normalizedJobs
      .filter((job) => seeded.oversizedJobIds.includes(job.id))
      .map((job) => job.name);
    return {
      status: "blocked",
      recommendation: "review",
      forms: [],
      errors: [`Følgende formater kan ikke være på råarket: ${oversizedNames.join(", ")}.`],
      warnings: sheet.warnings,
      pooledCost: 0,
      standaloneCost: 0,
      estimatedSavings: 0,
      estimatedSavingsPct: 0,
      pooledSellPrice: 0,
      netSheets: 0,
      totalSheets: 0,
      standaloneTotalSheets: 0,
      materialSheetsSaved: 0,
      setupMinutesSaved: 0,
    };
  }

  const jobById = new Map(normalizedJobs.map((job) => [job.id, job]));
  const groupedJobs = seeded.bins.map((bin) => unique(
    bin.rects.map((rectangle) => (rectangle.data as PackedSlotData).jobId),
  ).map((jobId) => jobById.get(jobId)).filter((job): job is JobPoolDraft => Boolean(job)));

  const forms = groupedJobs
    .map((group, index) => buildForm(
      `form-${index + 1}`,
      group,
      sheet.geometry!,
      machine,
      material,
      inkSet,
      settings,
    ))
    .filter((form): form is JobPoolForm => Boolean(form));

  const standaloneForms = normalizedJobs
    .map((job, index) => buildForm(
      `standalone-${index + 1}`,
      [job],
      sheet.geometry!,
      machine,
      material,
      inkSet,
      settings,
    ))
    .filter((form): form is JobPoolForm => Boolean(form));

  if (forms.length !== groupedJobs.length || standaloneForms.length !== normalizedJobs.length) {
    return {
      status: "blocked",
      recommendation: "review",
      forms: [],
      errors: ["Sammelformen kunne ikke beregnes stabilt for alle jobs."],
      warnings: sheet.warnings,
      pooledCost: 0,
      standaloneCost: 0,
      estimatedSavings: 0,
      estimatedSavingsPct: 0,
      pooledSellPrice: 0,
      netSheets: 0,
      totalSheets: 0,
      standaloneTotalSheets: 0,
      materialSheetsSaved: 0,
      setupMinutesSaved: 0,
    };
  }

  const pooledCost = forms.reduce((sum, form) => sum + form.cost.baseCost, 0);
  const standaloneCost = standaloneForms.reduce((sum, form) => sum + form.cost.baseCost, 0);
  const estimatedSavings = standaloneCost - pooledCost;
  const netSheets = forms.reduce((sum, form) => sum + form.netSheets, 0);
  const totalSheets = forms.reduce((sum, form) => sum + form.totalSheets, 0);
  const standaloneTotalSheets = standaloneForms.reduce((sum, form) => sum + form.totalSheets, 0);
  const targetMargin = Math.min(95, Math.max(0, numberOrZero(settings.targetMarginPct)));
  const rawSellPrice = targetMargin > 0 ? pooledCost / (1 - targetMargin / 100) : pooledCost;
  const warnings = [
    ...sheet.warnings,
    ...costWarnings(machine, material, inkSet, settings),
    ...(forms.some((form) => form.slotLimitReached)
      ? ["Et ark nåede pilotens grænse på 180 pladser; meget små emner kræver en særskilt løsning."]
      : []),
  ];
  const recommendation = normalizedJobs.length < 2 || forms.length >= normalizedJobs.length || estimatedSavings <= 0
    ? "separate"
    : warnings.length > 0
      ? "review"
      : "pool";

  return {
    status: "ready",
    recommendation,
    forms,
    errors: [],
    warnings: unique(warnings),
    pooledCost,
    standaloneCost,
    estimatedSavings,
    estimatedSavingsPct: standaloneCost > 0 ? estimatedSavings / standaloneCost * 100 : 0,
    pooledSellPrice: roundUp(rawSellPrice, Math.max(0, numberOrZero(settings.roundingStep))),
    netSheets,
    totalSheets,
    standaloneTotalSheets,
    materialSheetsSaved: standaloneTotalSheets - totalSheets,
    setupMinutesSaved: Math.max(0, normalizedJobs.length - forms.length) * Math.max(0, numberOrZero(machine.setup_time_min)),
  };
}
