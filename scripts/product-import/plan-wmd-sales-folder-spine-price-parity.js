#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

export const AXIS_ORDER = Object.freeze(["folder_model", "print", "spine", "paper", "finish"]);
export const SPINES = Object.freeze(["1mm", "3mm", "5mm", "10mm"]);
export const TARGET_SPINES = Object.freeze(SPINES.slice(1));
export const STRATEGIES = Object.freeze({
  copy1mm: "copy_1mm",
  maxExisting: "max_existing_webprinter_price",
});
export const AVAILABILITY_SECTION_IDS = Object.freeze({
  spine: "sales-folder-spine",
});

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_RUN_DIR = path.join(
  REPO_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full",
);

export class SpineParityPlanBlockedError extends Error {
  constructor(plan) {
    super(`Spine price parity plan is blocked: ${plan.blockers.map((item) => item.code).join(", ")}`);
    this.name = "SpineParityPlanBlockedError";
    this.plan = plan;
  }
}

function asNonEmptyString(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} must be a non-empty string`);
  return text;
}

function asFiniteMoney(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${field} must be a non-negative number`);
  return number;
}

function round(value, places = 6) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function encoded(value) {
  return encodeURIComponent(String(value));
}

export function configurationSignature(selections) {
  return AXIS_ORDER.map((axis) => `${axis}=${encoded(asNonEmptyString(selections?.[axis], `selections.${axis}`))}`).join("|");
}

export function priceSignature(row) {
  const quantity = Number(row?.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("quantity must be a positive integer");
  return `${configurationSignature(row.selections)}|quantity=${quantity}`;
}

export function paritySignature(row) {
  const selections = row?.selections || {};
  const quantity = Number(row?.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("quantity must be a positive integer");
  return ["folder_model", "print", "paper", "finish"]
    .map((axis) => `${axis}=${encoded(asNonEmptyString(selections[axis], `selections.${axis}`))}`)
    .concat(`quantity=${quantity}`)
    .join("|");
}

function bindingSignature(binding) {
  return configurationSignature(binding?.match);
}

function sha256File(filePath) {
  const hash = createHash("sha256");
  const handle = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    fs.closeSync(handle);
  }
  return hash.digest("hex");
}

async function readJsonl(filePath, project) {
  const rows = [];
  const input = fs.createReadStream(filePath);
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    try {
      rows.push(project(JSON.parse(line)));
    } catch (error) {
      throw new Error(`${path.basename(filePath)} line ${lineNumber}: ${error.message}`);
    }
  }
  return rows;
}

function sourceSupplierValues(row) {
  const evidence = row?.sourceEvidence && typeof row.sourceEvidence === "object"
    ? row.sourceEvidence
    : {};
  return {
    supplierPrice: row?.supplierPrice == null ? null : Number(row.supplierPrice),
    supplierCurrency: row?.supplierCurrency ?? null,
    convertedPriceDkk: row?.convertedPriceDkk == null ? null : Number(row.convertedPriceDkk),
    conversionRuleKey: row?.conversionRuleKey ?? null,
    conversionFactor: row?.conversionFactor == null ? null : Number(row.conversionFactor),
    tierMultiplier: row?.tierMultiplier == null ? null : Number(row.tierMultiplier),
    sourceEvidence: { ...evidence },
  };
}

function cleanPriceRow(row, index) {
  const selections = Object.fromEntries(
    AXIS_ORDER.map((axis) => [axis, asNonEmptyString(row?.selections?.[axis], `priceRows[${index}].selections.${axis}`)]),
  );
  if (!SPINES.includes(selections.spine)) {
    throw new Error(`priceRows[${index}].selections.spine is unsupported: ${selections.spine}`);
  }
  const quantity = Number(row.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`priceRows[${index}].quantity must be a positive integer`);
  }
  return {
    ...row,
    selections,
    quantity,
    finalPriceDkk: asFiniteMoney(row.finalPriceDkk, `priceRows[${index}].finalPriceDkk`),
    convertedPriceDkk: row.convertedPriceDkk == null
      ? null
      : asFiniteMoney(row.convertedPriceDkk, `priceRows[${index}].convertedPriceDkk`),
  };
}

function cleanBinding(binding, index) {
  const match = Object.fromEntries(
    AXIS_ORDER.map((axis) => [axis, asNonEmptyString(binding?.match?.[axis], `templateBindings[${index}].match.${axis}`)]),
  );
  return {
    documentKey: binding?.documentKey ?? null,
    match,
    template: binding?.template ? {
      sanitizedPdfPath: binding.template.sanitizedPdfPath ?? null,
      sanitizedPdfSha256: binding.template.sanitizedPdfSha256 ?? null,
      designerTemplateId: binding.template.designerTemplateId ?? null,
      artworkMode: binding.template.artworkMode ?? null,
    } : null,
  };
}

function indexUnique(rows, signatureFor) {
  const unique = new Map();
  const collisions = new Map();
  for (const row of rows) {
    const signature = signatureFor(row);
    if (!unique.has(signature)) {
      unique.set(signature, row);
      continue;
    }
    if (!collisions.has(signature)) collisions.set(signature, [unique.get(signature)]);
    collisions.get(signature).push(row);
  }
  return { unique, collisions };
}

function countBy(rows, valueFor) {
  const result = {};
  for (const row of rows) {
    const key = String(valueFor(row));
    result[key] = (result[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function extremaCandidate(row, amountDkk, percent) {
  return {
    priceSignature: row.priceSignature,
    folderModel: row.selections.folder_model,
    print: row.selections.print,
    spine: row.selections.spine,
    paper: row.selections.paper,
    finish: row.selections.finish,
    quantity: row.quantity,
    sellingPriceDkk: row.sellingPriceDkk,
    supplierCostDkk: row.supplierCostDkk,
    grossMarginDkk: amountDkk,
    grossMarginPercent: percent,
    supplierCostBasis: row.supplierCostBasis,
  };
}

function updateExtrema(target, row) {
  if (row.supplierCostDkk == null) return;
  const amountDkk = round(row.sellingPriceDkk - row.supplierCostDkk);
  const percent = row.sellingPriceDkk === 0
    ? null
    : round((amountDkk / row.sellingPriceDkk) * 100);
  const candidate = extremaCandidate(row, amountDkk, percent);
  if (!target.minimumGrossMarginDkk || amountDkk < target.minimumGrossMarginDkk.grossMarginDkk) {
    target.minimumGrossMarginDkk = candidate;
  }
  if (!target.maximumGrossMarginDkk || amountDkk > target.maximumGrossMarginDkk.grossMarginDkk) {
    target.maximumGrossMarginDkk = candidate;
  }
  if (percent != null && (!target.minimumGrossMarginPercent || percent < target.minimumGrossMarginPercent.grossMarginPercent)) {
    target.minimumGrossMarginPercent = candidate;
  }
  if (percent != null && (!target.maximumGrossMarginPercent || percent > target.maximumGrossMarginPercent.grossMarginPercent)) {
    target.maximumGrossMarginPercent = candidate;
  }
}

function newCommercialBucket(key) {
  return {
    key,
    rows: 0,
    exactTargetSupplierCostRows: 0,
    canonical1mmProxyCostRows: 0,
    unknownSupplierCostRows: 0,
    belowSupplierCostRows: 0,
    minimumGrossMarginDkk: null,
    maximumGrossMarginDkk: null,
    minimumGrossMarginPercent: null,
    maximumGrossMarginPercent: null,
  };
}

function summarizeCommercialSafety(rows) {
  const total = newCommercialBucket("all");
  const dimensions = {
    byModel: new Map(),
    byPaper: new Map(),
    byFinish: new Map(),
    byModelPaperFinish: new Map(),
  };
  const add = (bucket, row) => {
    bucket.rows += 1;
    if (row.supplierCostBasis === "exact_target_supplier_row") bucket.exactTargetSupplierCostRows += 1;
    else if (row.supplierCostBasis === "canonical_1mm_proxy") bucket.canonical1mmProxyCostRows += 1;
    else bucket.unknownSupplierCostRows += 1;
    if (row.supplierCostDkk != null && row.sellingPriceDkk < row.supplierCostDkk) {
      bucket.belowSupplierCostRows += 1;
    }
    updateExtrema(bucket, row);
  };
  const addDimension = (map, key, row) => {
    if (!map.has(key)) map.set(key, newCommercialBucket(key));
    add(map.get(key), row);
  };
  for (const row of rows) {
    add(total, row);
    addDimension(dimensions.byModel, row.selections.folder_model, row);
    addDimension(dimensions.byPaper, row.selections.paper, row);
    addDimension(dimensions.byFinish, row.selections.finish, row);
    addDimension(
      dimensions.byModelPaperFinish,
      `${row.selections.folder_model}|${row.selections.paper}|${row.selections.finish}`,
      row,
    );
  }
  const sorted = (map) => [...map.values()].sort((left, right) => left.key.localeCompare(right.key));
  return {
    scope: "every 1/3/5/10 mm row after parity, including unchanged rows",
    supplierCostPolicy: {
      existingRows: "Use the exact target-spine convertedPriceDkk and preserve its supplier evidence.",
      absentRows: "Do not create a price or infer a supplier cost for an absent target-spine row.",
    },
    totals: total,
    byModel: sorted(dimensions.byModel),
    byPaper: sorted(dimensions.byPaper),
    byFinish: sorted(dimensions.byFinish),
    byModelPaperFinish: sorted(dimensions.byModelPaperFinish),
  };
}

function compactTemplate(binding) {
  if (!binding) return null;
  return {
    documentKey: binding.documentKey,
    sanitizedPdfPath: binding.template?.sanitizedPdfPath ?? null,
    sanitizedPdfSha256: binding.template?.sanitizedPdfSha256 ?? null,
    designerTemplateId: binding.template?.designerTemplateId ?? null,
    artworkMode: binding.template?.artworkMode ?? null,
  };
}

function strategyCanonical(strategy, groupRows) {
  const oneMillimeter = groupRows.get("1mm");
  if (strategy === STRATEGIES.copy1mm) return oneMillimeter;
  if (strategy !== STRATEGIES.maxExisting) throw new Error(`Unknown parity strategy: ${strategy}`);
  return [...groupRows.values()].sort((left, right) => {
    const priceDifference = Number(right.finalPriceDkk) - Number(left.finalPriceDkk);
    if (priceDifference) return priceDifference;
    return SPINES.indexOf(left.selections.spine) - SPINES.indexOf(right.selections.spine);
  })[0];
}

function planStrategy({ strategy, groups, bindingIndex, beforePriceRows }) {
  const delta = [];
  const commercialRows = [];
  let unchangedRows = 0;
  for (const groupRows of groups.values()) {
    const oneMillimeter = groupRows.get("1mm");
    if (!oneMillimeter) continue;
    const canonical = strategyCanonical(strategy, groupRows);
    const sellingPriceDkk = Number(canonical.finalPriceDkk);
    for (const spine of SPINES) {
      const existing = groupRows.get(spine) || null;
      if (!existing) continue;
      const selections = existing.selections;
      const exactPriceSignature = priceSignature(existing);
      const exactBinding = bindingIndex.get(configurationSignature(selections)) || null;
      const supplierCostDkk = existing.convertedPriceDkk ?? null;
      const supplierCostBasis = supplierCostDkk == null ? "unknown" : "exact_target_supplier_row";
      commercialRows.push({
        priceSignature: exactPriceSignature,
        selections,
        quantity: oneMillimeter.quantity,
        sellingPriceDkk,
        supplierCostDkk,
        supplierCostBasis,
      });
      if (existing && Number(existing.finalPriceDkk) === sellingPriceDkk) {
        unchangedRows += 1;
        continue;
      }
      delta.push({
        operation: "update",
        priceSignature: exactPriceSignature,
        paritySignature: paritySignature(existing),
        selections,
        quantity: oneMillimeter.quantity,
        before: {
          finalPriceDkk: Number(existing.finalPriceDkk),
          targetSupplierValues: sourceSupplierValues(existing),
        },
        after: {
          finalPriceDkk: sellingPriceDkk,
          supplierValuesWritePolicy: "preserve_exact_target_supplier_values_and_evidence",
          targetSupplierValues: sourceSupplierValues(existing),
          canonical1mmSupplierValues: sourceSupplierValues(oneMillimeter),
        },
        canonicalPriceSource: {
          strategy,
          priceSignature: priceSignature(canonical),
          spine: canonical.selections.spine,
          finalPriceDkk: Number(canonical.finalPriceDkk),
        },
        exactTemplateBinding: compactTemplate(exactBinding),
        writeBoundary: ["price_dkk"],
      });
    }
  }
  const updates = delta.filter((item) => item.operation === "update");
  const plannedCollisions = indexUnique(delta, (item) => item.priceSignature).collisions;
  return {
    strategy,
    description: strategy === STRATEGIES.copy1mm
      ? "Use the exact 1 mm Webprinter selling price for 1, 3, 5 and 10 mm within the same model, print, paper, finishing and quantity."
      : "Use the highest existing Webprinter selling price across 1, 3, 5 and 10 mm within the same model, print, paper, finishing and quantity.",
    beforeRows: beforePriceRows,
    updateRows: updates.length,
    insertRows: 0,
    updatedParityGroups: new Set(updates.map((item) => item.paritySignature)).size,
    insertedParityGroups: 0,
    changedParityGroups: new Set(delta.map((item) => item.paritySignature)).size,
    unchangedRows,
    afterRows: beforePriceRows,
    updatesBySpine: countBy(updates, (item) => item.selections.spine),
    insertsBySpine: {},
    deltaByFinish: countBy(delta, (item) => item.selections.finish),
    deltaByModel: countBy(delta, (item) => item.selections.folder_model),
    plannedSignatureCollisionCount: plannedCollisions.size,
    commercialSafety: summarizeCommercialSafety(commercialRows),
    delta,
  };
}

function buildAvailabilityPatch({ cleanPrices, bindingIndex, suppressedRows }) {
  const priceSpinesByModel = new Map();
  const bindingSpinesByModel = new Map();
  for (const row of cleanPrices) {
    const model = row.selections.folder_model;
    if (!priceSpinesByModel.has(model)) priceSpinesByModel.set(model, new Set());
    priceSpinesByModel.get(model).add(row.selections.spine);
  }
  for (const binding of bindingIndex.values()) {
    const model = binding.match.folder_model;
    if (!bindingSpinesByModel.has(model)) bindingSpinesByModel.set(model, new Set());
    bindingSpinesByModel.get(model).add(binding.match.spine);
  }
  const modelRules = [...priceSpinesByModel.entries()].map(([folderModel, priceSpines]) => {
    const bindingSpines = bindingSpinesByModel.get(folderModel) || new Set();
    const availableSpines = SPINES.filter((spine) => priceSpines.has(spine) && bindingSpines.has(spine));
    return {
      folderModel,
      availableSpines,
      hiddenSpines: SPINES.filter((spine) => !availableSpines.includes(spine)),
      reason: "A spine is available only when existing exact price rows and exact template bindings both exist.",
    };
  }).sort((left, right) => left.folderModel.localeCompare(right.folderModel));
  const oneMillimeterOnlyModels = modelRules.filter((rule) => (
    rule.availableSpines.length === 1 && rule.availableSpines[0] === "1mm"
  ));
  return {
    operation: "merge_into_existing_pricing_structure_after_separate_approval",
    runtimeBasis: "MatrixLayoutV1Renderer derives availability from exact sparse price rows; every retained row is preflighted against one exact template binding.",
    sections: [
      {
        selector: { sectionId: AVAILABILITY_SECTION_IDS.spine },
        set: { hideUnavailableValues: true, hide_unavailable_values: true },
      },
    ],
    preservedVisibleCompatibilityAxes: ["paper", "finish"],
    compatibilityBehavior:
      "Paper and finishing values stay visible so selecting a finishing can opt in to the exact-combination resolver and switch to a compatible documented paper.",
    modelRules,
    oneMillimeterOnlyModels,
    suppressedMissingPriceRows: suppressedRows.length,
    performsDatabaseWrite: false,
  };
}

export function applySparseAvailabilityPatch(pricingStructure, productStructurePatch) {
  const next = JSON.parse(JSON.stringify(pricingStructure));
  const sections = [next.vertical_axis, ...(next.layout_rows || []).flatMap((row) => row.columns || [])]
    .filter(Boolean);
  for (const instruction of productStructurePatch.sections || []) {
    const section = sections.find((candidate) => (
      candidate.sectionId === instruction.selector.sectionId
      || candidate.id === instruction.selector.sectionId
    ));
    if (!section) throw new Error(`Cannot find pricing section ${instruction.selector.sectionId}`);
    Object.assign(section, instruction.set);
  }
  return next;
}

export function buildSpinePriceParityPlan({ priceRows, templateBindings }) {
  if (!Array.isArray(priceRows)) throw new Error("priceRows must be an array");
  if (!Array.isArray(templateBindings)) throw new Error("templateBindings must be an array");
  const cleanPrices = priceRows.map(cleanPriceRow);
  const cleanBindings = templateBindings.map(cleanBinding);
  const priceIndexResult = indexUnique(cleanPrices, priceSignature);
  const bindingIndexResult = indexUnique(cleanBindings, bindingSignature);
  const groups = new Map();
  for (const row of priceIndexResult.unique.values()) {
    const key = paritySignature(row);
    if (!groups.has(key)) groups.set(key, new Map());
    const group = groups.get(key);
    const spine = row.selections.spine;
    if (group.has(spine)) {
      throw new Error(`Internal spine collision for ${key}/${spine}`);
    }
    group.set(spine, row);
  }

  const requiredExistingConfigurations = new Map();
  for (const row of priceIndexResult.unique.values()) {
    requiredExistingConfigurations.set(configurationSignature(row.selections), row.selections);
  }
  const suppressedRows = [];
  const existingRowsWithout1mmCanonical = [];
  for (const groupRows of groups.values()) {
    const oneMillimeter = groupRows.get("1mm");
    if (!oneMillimeter) {
      for (const row of groupRows.values()) existingRowsWithout1mmCanonical.push(priceSignature(row));
      continue;
    }
    for (const spine of TARGET_SPINES) {
      if (groupRows.has(spine)) continue;
      const selections = { ...oneMillimeter.selections, spine };
      const synthetic = { selections, quantity: oneMillimeter.quantity };
      suppressedRows.push({
        priceSignature: priceSignature(synthetic),
        configurationSignature: configurationSignature(selections),
        paritySignature: paritySignature(synthetic),
        selections,
        quantity: oneMillimeter.quantity,
        exactTemplateBindingExists: bindingIndexResult.unique.has(configurationSignature(selections)),
        reason: "No exact target-spine supplier price row exists; keep the choice unavailable instead of deriving an orderable price.",
      });
    }
  }
  const missingExistingTemplateBindings = [...requiredExistingConfigurations]
    .filter(([signature]) => !bindingIndexResult.unique.has(signature))
    .map(([signature, selections]) => ({ signature, selections }))
    .sort((left, right) => left.signature.localeCompare(right.signature));
  const suppressedConfigurationIndex = new Map(
    suppressedRows.map((row) => [row.configurationSignature, row.selections]),
  );
  const suppressedByModel = countBy(suppressedRows, (row) => row.selections.folder_model);
  const suppressedBySpine = countBy(suppressedRows, (row) => row.selections.spine);
  const suppressedByFinish = countBy(suppressedRows, (row) => row.selections.finish);
  const productStructurePatch = buildAvailabilityPatch({
    cleanPrices,
    bindingIndex: bindingIndexResult.unique,
    suppressedRows,
  });

  const strategies = {
    [STRATEGIES.copy1mm]: planStrategy({
      strategy: STRATEGIES.copy1mm,
      groups,
      bindingIndex: bindingIndexResult.unique,
      beforePriceRows: cleanPrices.length,
    }),
    [STRATEGIES.maxExisting]: planStrategy({
      strategy: STRATEGIES.maxExisting,
      groups,
      bindingIndex: bindingIndexResult.unique,
      beforePriceRows: cleanPrices.length,
    }),
  };

  const blockers = [];
  if (priceIndexResult.collisions.size) {
    blockers.push({
      code: "duplicate_price_signatures",
      count: priceIndexResult.collisions.size,
      signatures: [...priceIndexResult.collisions.keys()].sort(),
    });
  }
  if (bindingIndexResult.collisions.size) {
    blockers.push({
      code: "duplicate_template_bindings",
      count: bindingIndexResult.collisions.size,
      signatures: [...bindingIndexResult.collisions.keys()].sort(),
    });
  }
  if (missingExistingTemplateBindings.length) {
    blockers.push({
      code: "missing_exact_template_bindings_for_existing_price_rows",
      count: missingExistingTemplateBindings.length,
      configurations: missingExistingTemplateBindings,
    });
  }
  for (const strategy of Object.values(strategies)) {
    if (strategy.plannedSignatureCollisionCount) {
      blockers.push({
        code: "planned_delta_signature_collisions",
        strategy: strategy.strategy,
        count: strategy.plannedSignatureCollisionCount,
      });
    }
  }

  return {
    schemaVersion: 1,
    operation: "dry_run_only_sales_folder_spine_price_parity",
    proposedStrategy: STRATEGIES.maxExisting,
    rejectedComparisonStrategy: STRATEGIES.copy1mm,
    commercialDecision: {
      reason:
        "Use the highest existing Webprinter selling price per exact model, print, paper, finishing and quantity group so every spine has one price without lowering an existing selling price below its preserved target-spine supplier cost.",
      copy1mmBelowSupplierCostRows:
        strategies[STRATEGIES.copy1mm].commercialSafety.totals.belowSupplierCostRows,
      maxExistingBelowSupplierCostRows:
        strategies[STRATEGIES.maxExisting].commercialSafety.totals.belowSupplierCostRows,
      selectedByPlanner: false,
      note:
        "This artifact records the reviewed commercial decision but remains dry-run-only. A separate writer and approval/readback gate are required.",
    },
    invariants: {
      canonicalSpineForCopyStrategy: "1mm",
      targetSpines: TARGET_SPINES,
      exactMatchAxes: ["folder_model", "print", "paper", "finish", "quantity"],
      sparseCompatibilityPreserved: true,
      targetSupplierValuesPreservedOnUpdate: true,
      onlySellingPriceCanonicalized: true,
      exactTemplateBindingRequiredForEveryExistingPriceConfiguration: true,
      newTemplateBindingsRequiredByPlan: 0,
      missingPriceRowsAreNeverInferred: true,
      unsupportedSpinesStayUnavailable: true,
      performsSupabaseWrites: false,
    },
    before: {
      priceRows: cleanPrices.length,
      priceRowsBySpine: countBy(cleanPrices, (row) => row.selections.spine),
      parityGroups: groups.size,
      parityGroupsWith1mmCanonical: [...groups.values()].filter((group) => group.has("1mm")).length,
      existingRowsWithout1mmCanonical: existingRowsWithout1mmCanonical.length,
      templateBindingRows: cleanBindings.length,
      uniqueTemplateBindings: bindingIndexResult.unique.size,
      requiredExistingPriceConfigurations: requiredExistingConfigurations.size,
      existingPriceConfigurationsWithExactTemplateBinding:
        requiredExistingConfigurations.size - missingExistingTemplateBindings.length,
    },
    suppressedMissingRows: {
      proposedInsertsIntentionallySuppressed: suppressedRows.length,
      uniqueConfigurations: suppressedConfigurationIndex.size,
      exactTemplateBindingsPresent: suppressedRows.filter((row) => row.exactTemplateBindingExists).length,
      newTemplateBindingsRequired: 0,
      byModel: suppressedByModel,
      bySpine: suppressedBySpine,
      byFinish: suppressedByFinish,
      configurations: [...suppressedConfigurationIndex.entries()]
        .map(([signature, selections]) => ({ signature, selections }))
        .sort((left, right) => left.signature.localeCompare(right.signature)),
      reason:
        "The supplier/template boundary supports these standard no-flap models at 1 mm only. Missing 3/5/10 mm rows remain unavailable and are not synthesized.",
    },
    productStructurePatch,
    strategies,
    blockers,
    readyForSeparateReviewedWrite: blockers.length === 0,
  };
}

export function assertSpinePriceParityPlanReady(plan) {
  if (plan.blockers?.length) throw new SpineParityPlanBlockedError(plan);
  return plan;
}

export function parseArgs(argv) {
  const forbidden = argv.filter((argument) => /^(--apply|--write|--confirm|--publish)/.test(argument));
  if (forbidden.length) {
    throw new Error(`This planner is dry-run-only; forbidden flag(s): ${forbidden.join(", ")}`);
  }
  const readValue = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : null;
  };
  const runDir = path.resolve(readValue("--run-dir") || DEFAULT_RUN_DIR);
  return {
    runDir,
    pricesPath: path.resolve(readValue("--prices") || path.join(runDir, "review/proposed-price-rows.jsonl")),
    bindingsPath: path.resolve(readValue("--bindings") || path.join(runDir, "review/import-template-binding-map.jsonl")),
    outputPath: path.resolve(readValue("--output") || path.join(runDir, "review/spine-price-parity-plan.json")),
  };
}

export async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  for (const [field, filePath] of [["prices", args.pricesPath], ["bindings", args.bindingsPath]]) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new Error(`${field} JSONL does not exist: ${filePath}`);
    }
  }
  const [priceRows, templateBindings] = await Promise.all([
    readJsonl(args.pricesPath, (row) => row),
    readJsonl(args.bindingsPath, (row) => row),
  ]);
  const plan = buildSpinePriceParityPlan({ priceRows, templateBindings });
  const report = {
    ...plan,
    generatedAt: new Date().toISOString(),
    inputs: {
      prices: {
        path: path.relative(REPO_ROOT, args.pricesPath),
        rows: priceRows.length,
        sha256: sha256File(args.pricesPath),
      },
      templateBindings: {
        path: path.relative(REPO_ROOT, args.bindingsPath),
        rows: templateBindings.length,
        sha256: sha256File(args.bindingsPath),
      },
    },
  };
  fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });
  fs.writeFileSync(args.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  assertSpinePriceParityPlanReady(report);
  return { report, outputPath: args.outputPath };
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  run()
    .then(({ report, outputPath }) => {
      const copy = report.strategies[STRATEGIES.copy1mm];
      const max = report.strategies[STRATEGIES.maxExisting];
      process.stdout.write(`${JSON.stringify({
        outputPath,
        readyForSeparateReviewedWrite: report.readyForSeparateReviewedWrite,
        proposedStrategy: report.proposedStrategy,
        proposedInsertsIntentionallySuppressed:
          report.suppressedMissingRows.proposedInsertsIntentionallySuppressed,
        oneMillimeterOnlyModels:
          report.productStructurePatch.oneMillimeterOnlyModels.map((rule) => rule.folderModel),
        copy1mm: {
          updateRows: copy.updateRows,
          insertRows: copy.insertRows,
          belowSupplierCostRows: copy.commercialSafety.totals.belowSupplierCostRows,
        },
        maxExisting: {
          updateRows: max.updateRows,
          insertRows: max.insertRows,
          belowSupplierCostRows: max.commercialSafety.totals.belowSupplierCostRows,
        },
      }, null, 2)}\n`);
    })
    .catch((error) => {
      const details = error instanceof SpineParityPlanBlockedError
        ? {
            blockers: error.plan.blockers.map((blocker) => ({
              code: blocker.code,
              count: blocker.count,
              strategy: blocker.strategy,
            })),
          }
        : {};
      process.stderr.write(`${JSON.stringify({ error: error.message, ...details }, null, 2)}\n`);
      process.exitCode = 1;
    });
}
