import type { PodFulfillmentJob } from "../pod2/types.ts";
import { classifyOrder } from "./readiness.ts";
import type { OrderGroup } from "./types.ts";

export type PrintcomPaymentMethod = "invoice" | "psp";

export interface RealSubmissionCheck {
  jobId: string;
  status: PodFulfillmentJob["status"];
  printcomOrderId: string | null;
  validatedJobId: string;
  validationPassed: boolean;
  paymentMethod: PrintcomPaymentMethod;
  validatedPaymentMethod: PrintcomPaymentMethod;
  jobVersion: string;
  validatedJobVersion: string;
}

export type DryRunResultKind = "ready" | "manual_check" | "blocked";

export interface DryRunInterpretation {
  kind: DryRunResultKind;
  label: string;
  description: string;
  payload?: unknown;
  response?: unknown;
}

export interface ValidationBinding {
  jobId: string;
  jobVersion: string;
  passed: boolean;
  kind: DryRunResultKind;
}

export interface SubmissionSessionState {
  blockedJobIds: Record<string, { refreshConfirmed: boolean }>;
}

export interface ProductionOrderPresentation {
  group: OrderGroup;
  label: string;
  canValidate: boolean;
  canSubmit: boolean;
  nextAction: string;
}

const LIVE_SUBMISSION_STATUSES = new Set<PodFulfillmentJob["status"]>([
  "awaiting_approval",
  "paid",
  "processing",
  "submitted",
]);

export function buildValidationRequest(
  jobId: string,
  paymentMethod: PrintcomPaymentMethod,
) {
  return {
    jobId,
    paymentMethod,
    dryRun: true,
  };
}

export function canConfirmRealSubmission(input: RealSubmissionCheck): boolean {
  return hasText(input.jobId)
    && input.printcomOrderId === null
    && LIVE_SUBMISSION_STATUSES.has(input.status)
    && input.validationPassed
    && hasText(input.validatedJobId)
    && input.validatedJobId === input.jobId
    && hasPaymentMethod(input.paymentMethod)
    && input.paymentMethod === input.validatedPaymentMethod
    && hasText(input.jobVersion)
    && input.jobVersion === input.validatedJobVersion;
}

export function interpretDryRunResult(result: unknown): DryRunInterpretation {
  const record = asRecord(result);
  const payload = record.payload;
  const warnings = record.warnings;

  if (record.success !== true || record.dryRun !== true || !isNonEmptyRecord(payload)) {
    return blockedDryRun("Kontrolsvaret kunne ikke bekræftes. Kontrollér ordren igen.", payload, record.response);
  }
  if (!Array.isArray(warnings) || warnings.length > 0 || hasMeaningfulError(record.error)) {
    return blockedDryRun("Kontrollen har advarsler eller fejl. Gennemgå ordren og kontrollér igen.", payload, record.response);
  }

  const supplierResult = readSupplierResult(record);
  if (supplierResult === "MANUALCHECK") {
    return {
      kind: "manual_check",
      label: "Leverandøren skal gennemgå filen",
      description: "Kontrolsvaret kræver manuel leverandørgennemgang. Der kan ikke oprettes en leverandørordre herfra.",
      payload,
      response: record.response,
    };
  }

  return {
    kind: "ready",
    label: "Klar til produktion",
    description: "Dry run er gennemført uden advarsler. Bekræft kun, hvis ordregrundlaget stadig er aktuelt.",
    payload,
    response: record.response,
  };
}

export function resolveCurrentJob(
  jobs: PodFulfillmentJob[],
  jobId: string | null | undefined,
): PodFulfillmentJob | null {
  if (!hasText(jobId)) return null;
  return jobs.find((job) => job.id === jobId) || null;
}

export function createSubmissionSessionState(): SubmissionSessionState {
  return { blockedJobIds: {} };
}

export function startUncertainSubmissionReconciliation(
  state: SubmissionSessionState,
  jobId: string,
): SubmissionSessionState {
  if (!hasText(jobId)) return state;
  return {
    blockedJobIds: {
      ...state.blockedJobIds,
      [jobId]: { refreshConfirmed: false },
    },
  };
}

export function isReconciliationBlocked(state: SubmissionSessionState, jobId: string): boolean {
  return state.blockedJobIds[jobId] !== undefined;
}

export function markSubmissionReconciliationRefreshed(
  state: SubmissionSessionState,
  jobId: string,
): SubmissionSessionState {
  if (!isReconciliationBlocked(state, jobId)) return state;
  return {
    blockedJobIds: {
      ...state.blockedJobIds,
      [jobId]: { refreshConfirmed: true },
    },
  };
}

export function canReconcileUncertainSubmission(
  state: SubmissionSessionState,
  job: PodFulfillmentJob | null,
): boolean {
  return Boolean(job)
    && isReconciliationBlocked(state, job.id)
    && state.blockedJobIds[job.id]?.refreshConfirmed === true
    && job.printcom_order_id == null;
}

export function reconcileUncertainSubmission(
  state: SubmissionSessionState,
  input: {
    jobId: string;
    job: PodFulfillmentJob | null;
    operatorConfirmedNoSupplierOrder: boolean;
  },
): SubmissionSessionState {
  if (!isReconciliationBlocked(state, input.jobId)) return state;
  if (!input.operatorConfirmedNoSupplierOrder || !canReconcileUncertainSubmission(state, input.job)) return state;

  const { [input.jobId]: _resolved, ...remainingBlockedJobs } = state.blockedJobIds;
  return { blockedJobIds: remainingBlockedJobs };
}

export function getProductionOrderPresentation(
  job: PodFulfillmentJob,
  context: {
    validation?: ValidationBinding | null;
    reconciliationBlocked?: boolean;
  } = {},
): ProductionOrderPresentation {
  const baseline = classifyOrder(job);
  const validationIsCurrent = isCurrentPassingValidation(job, context.validation);

  if (context.reconciliationBlocked) {
    return presentation("attention", "Kræver afklaring", false, false, "Bekræft afklaring");
  }
  if (job.status === "completed") {
    return presentation("completed", "Afsluttet", false, false, "Ingen handling");
  }
  if (job.printcom_order_id !== null && job.printcom_order_id !== undefined) {
    if (job.status === "submitted" || job.status === "processing") {
      return presentation("supplier", "Hos leverandøren", false, false, "Følg leverandørstatus");
    }
    return presentation("attention", "Leverandørreference fundet", false, false, "Følg leverandørstatus");
  }
  if (job.status === "submitted" || job.status === "processing") {
    return presentation("attention", "Mangler leverandørreference", true, false, "Kontrollér ordre");
  }
  if (job.status === "failed") {
    return presentation("attention", "Kræver handling", true, false, "Gennemgå og kontrollér");
  }
  if (isCurrentManualCheck(job, context.validation)) {
    return presentation("attention", "Leverandørgennemgang", false, false, "Afventer leverandørgennemgang");
  }
  if (job.status === "payment_pending") {
    return presentation("waiting", "Afventer betaling", false, false, "Afventer betaling");
  }
  if (LIVE_SUBMISSION_STATUSES.has(job.status)) {
    if (validationIsCurrent) {
      return presentation("ready", "Klar til produktion", true, true, "Bekræft leverandørordre");
    }
    const waitingLabel = job.status === "awaiting_approval" ? "Afventer godkendelse" : "Afventer kontrol";
    return presentation("waiting", waitingLabel, true, false, "Kontrollér ordre");
  }

  return presentation(
    baseline.group,
    baseline.label,
    baseline.canValidate,
    false,
    "Kontrollér ordre",
  );
}

export function groupProductionJobs(
  jobs: PodFulfillmentJob[],
  contextByJobId: Record<string, { validation?: ValidationBinding | null; reconciliationBlocked?: boolean }> = {},
): Record<OrderGroup, PodFulfillmentJob[]> {
  const groups: Record<OrderGroup, PodFulfillmentJob[]> = {
    attention: [],
    ready: [],
    supplier: [],
    completed: [],
    waiting: [],
  };

  for (const job of jobs) {
    groups[getProductionOrderPresentation(job, contextByJobId[job.id]).group].push(job);
  }

  return groups;
}

function blockedDryRun(description: string, payload: unknown, response: unknown): DryRunInterpretation {
  return {
    kind: "blocked",
    label: "Ordren kan ikke sendes",
    description,
    payload,
    response,
  };
}

function isCurrentPassingValidation(job: PodFulfillmentJob, validation: ValidationBinding | null | undefined): boolean {
  return validation?.jobId === job.id
    && validation.jobVersion === job.updated_at
    && validation.passed
    && validation.kind === "ready";
}

function isCurrentManualCheck(job: PodFulfillmentJob, validation: ValidationBinding | null | undefined): boolean {
  return validation?.jobId === job.id
    && validation.jobVersion === job.updated_at
    && validation.kind === "manual_check";
}

function presentation(
  group: OrderGroup,
  label: string,
  canValidate: boolean,
  canSubmit: boolean,
  nextAction: string,
): ProductionOrderPresentation {
  return { group, label, canValidate, canSubmit, nextAction };
}

function readSupplierResult(record: Record<string, unknown>): string | null {
  const response = asRecord(record.response);
  const values = [
    record.supplierStatus,
    record.supplier_status,
    record.supplierResult,
    record.supplier_result,
    record.status,
    record.result,
    response.supplierStatus,
    response.supplier_status,
    response.supplierResult,
    response.supplier_result,
    response.status,
    response.result,
  ];
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim().toUpperCase();
  }
  return null;
}

function hasPaymentMethod(value: unknown): value is PrintcomPaymentMethod {
  return value === "invoice" || value === "psp";
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasMeaningfulError(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return Object.keys(asRecord(value)).length > 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
