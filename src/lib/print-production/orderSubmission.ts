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
  currentSemanticFingerprint: string;
  validatedSemanticFingerprint: string;
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
  paymentMethod: PrintcomPaymentMethod;
  semanticFingerprint: string;
  passed: boolean;
  kind: DryRunResultKind;
}

export interface PendingValidationResolutionInput {
  pending: {
    jobId: string;
    preValidationVersion: string;
    preValidationFingerprint: string;
    deadlineAt: number;
  };
  currentJob: PodFulfillmentJob | null;
  now: number;
}

export type PendingValidationResolution =
  | { kind: "waiting" }
  | { kind: "accepted"; job: PodFulfillmentJob; semanticFingerprint: string }
  | { kind: "rejected"; message: string };

export type ValidationOutcomeState = "none" | "ready" | "manual_check" | "blocked" | "stale";

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
const SUPPORTED_SUPPLIER_SUCCESS_RESULTS = new Set(["SUCCESS", "OK", "ACCEPTED", "READY", "VALID"]);

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
    && input.jobVersion === input.validatedJobVersion
    && hasText(input.currentSemanticFingerprint)
    && input.currentSemanticFingerprint === input.validatedSemanticFingerprint;
}

export function interpretDryRunResult(result: unknown): DryRunInterpretation {
  const record = asRecord(result);
  const payload = record.payload;
  const warnings = record.warnings;

  if (record.success !== true || record.dryRun !== true || !isValidDryRunPayload(payload)) {
    return blockedDryRun("Kontrolsvaret kunne ikke bekræftes. Kontrollér ordren igen.", payload, record.response);
  }
  if (!Array.isArray(warnings) || warnings.length > 0 || hasMeaningfulError(record.error)) {
    return blockedDryRun("Kontrollen har advarsler eller fejl. Gennemgå ordren og kontrollér igen.", payload, record.response);
  }

  const supplierResult = readSupplierResult(record);
  if (supplierResult.present && supplierResult.value === "MANUALCHECK") {
    return {
      kind: "manual_check",
      label: "Leverandøren skal gennemgå filen",
      description: "Kontrolsvaret kræver manuel leverandørgennemgang. Der kan ikke oprettes en leverandørordre herfra.",
      payload,
      response: record.response,
    };
  }
  if (supplierResult.present && (!supplierResult.value || !SUPPORTED_SUPPLIER_SUCCESS_RESULTS.has(supplierResult.value))) {
    return blockedDryRun("Leverandørens kontrolstatus kan ikke godkendes. Gennemgå ordren og kontrollér igen.", payload, record.response);
  }

  return {
    kind: "ready",
    label: "Klar til produktion",
    description: "Dry run er gennemført uden advarsler. Bekræft kun, hvis ordregrundlaget stadig er aktuelt.",
    payload,
    response: record.response,
  };
}

export function buildSubmissionFingerprint(job: PodFulfillmentJob): string {
  // Keep this list explicit: it is the auditable contract for job fields that
  // can change supplier submission, recipient, product, delivery, or sender.
  // Deliberately excluded: audit actors/timestamps and dry-run diagnostics.
  return stableSerialize({
    id: job.id,
    tenant_id: job.tenant_id,
    order_id: job.order_id,
    order_item_id: job.order_item_id,
    catalog_product_id: job.catalog_product_id,
    product_id: job.product_id,
    product_name: job.product_name,
    variant_signature: job.variant_signature,
    qty: job.qty,
    tenant_cost: job.tenant_cost,
    currency: job.currency,
    status: job.status,
    customer_email: job.customer_email,
    recipient_name: job.recipient_name,
    recipient_company: job.recipient_company,
    delivery_summary: job.delivery_summary,
    shipping_method: job.shipping_method,
    sender_mode: job.sender_mode,
    sender_name: job.sender_name,
    sender_contact_id: job.sender_contact_id,
    sender_address_json: job.sender_address_json,
    sender_logo_url: job.sender_logo_url,
    provider_job_ref: job.provider_job_ref,
    master_notes: job.master_notes,
    printcom_cart_id: job.printcom_cart_id,
    printcom_cart_item_id: job.printcom_cart_item_id,
    printcom_printjob_id: job.printcom_printjob_id,
    printcom_design_id: job.printcom_design_id,
    printcom_order_id: job.printcom_order_id,
    printcom_submission_step: job.printcom_submission_step,
  });
}

export function resolvePendingValidation(input: PendingValidationResolutionInput): PendingValidationResolution {
  const { pending, currentJob, now } = input;
  if (!Number.isFinite(now) || !Number.isFinite(pending.deadlineAt) || now >= pending.deadlineAt) {
    return { kind: "rejected", message: "Den opdaterede jobtilstand kunne ikke bekræftes i tide. Kontrollér ordren igen." };
  }
  if (!currentJob || currentJob.updated_at === pending.preValidationVersion) {
    return { kind: "waiting" };
  }

  const semanticFingerprint = buildSubmissionFingerprint(currentJob);
  if (semanticFingerprint !== pending.preValidationFingerprint) {
    return { kind: "rejected", message: "Ordregrundlaget er ændret efter kontrollen. Kontrollér ordren igen." };
  }
  if (currentJob.printcom_order_id != null) {
    return { kind: "rejected", message: "En leverandørreference er gemt. Ordren kan ikke sendes igen." };
  }
  if (!LIVE_SUBMISSION_STATUSES.has(currentJob.status)) {
    return { kind: "rejected", message: "Jobstatus er ikke længere klar til leverandørindsendelse. Kontrollér ordren igen." };
  }

  return { kind: "accepted", job: currentJob, semanticFingerprint };
}

export function getValidationOutcomeState(
  job: PodFulfillmentJob,
  validation: ValidationBinding | null | undefined,
  paymentMethod: PrintcomPaymentMethod,
): ValidationOutcomeState {
  if (!validation || validation.jobId !== job.id) return "none";
  if (validation.kind === "blocked") return "blocked";
  if (!isCurrentValidationBinding(job, validation, paymentMethod)) return "stale";
  if (validation.kind === "manual_check") return "manual_check";
  return getProductionOrderPresentation(job, { validation, paymentMethod }).canSubmit ? "ready" : "stale";
}

export function summarizeDryRunPayload(payload: unknown): string {
  const items = asRecord(payload).items;
  if (!Array.isArray(items) || items.length === 0) return "";

  let quantity = 0;
  let hasQuantity = false;
  let optionCount = 0;
  for (const item of items) {
    const record = asRecord(item);
    if (typeof record.quantity === "number" && Number.isFinite(record.quantity)) {
      quantity += record.quantity;
      hasQuantity = true;
    }
    const options = record.options;
    optionCount += Array.isArray(options) ? options.length : Object.keys(asRecord(options)).length;
  }

  const parts = [`${items.length} ${items.length === 1 ? "vare" : "varer"}`];
  if (hasQuantity) parts.push(`${quantity} stk.`);
  if (optionCount > 0) parts.push(`${optionCount} ${optionCount === 1 ? "valg" : "valg"}`);
  return parts.join(" · ");
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
    paymentMethod?: PrintcomPaymentMethod;
    reconciliationBlocked?: boolean;
  } = {},
): ProductionOrderPresentation {
  const baseline = classifyOrder(job);
  const validationIsCurrent = isCurrentPassingValidation(job, context.validation, context.paymentMethod);

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
    if (isCurrentManualCheck(job, context.validation, context.paymentMethod)) {
      return presentation("attention", "Leverandørgennemgang", false, false, "Afventer leverandørgennemgang");
    }
    if (validationIsCurrent) {
      return presentation("ready", "Klar til produktion", true, true, "Bekræft leverandørordre");
    }
    return presentation("attention", "Mangler leverandørreference", true, false, "Kontrollér ordre");
  }
  if (job.status === "failed") {
    return presentation("attention", "Kræver handling", true, false, "Gennemgå og kontrollér");
  }
  if (isCurrentManualCheck(job, context.validation, context.paymentMethod)) {
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
  contextByJobId: Record<string, { validation?: ValidationBinding | null; paymentMethod?: PrintcomPaymentMethod; reconciliationBlocked?: boolean }> = {},
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

function isCurrentPassingValidation(
  job: PodFulfillmentJob,
  validation: ValidationBinding | null | undefined,
  paymentMethod: PrintcomPaymentMethod | undefined,
): boolean {
  return isCurrentValidationBinding(job, validation, paymentMethod)
    && validation.passed
    && validation.kind === "ready";
}

function isCurrentManualCheck(
  job: PodFulfillmentJob,
  validation: ValidationBinding | null | undefined,
  paymentMethod: PrintcomPaymentMethod | undefined,
): boolean {
  return isCurrentValidationBinding(job, validation, paymentMethod)
    && validation.kind === "manual_check";
}

function isCurrentValidationBinding(
  job: PodFulfillmentJob,
  validation: ValidationBinding | null | undefined,
  paymentMethod: PrintcomPaymentMethod | undefined,
): validation is ValidationBinding {
  return validation?.jobId === job.id
    && validation.jobVersion === job.updated_at
    && validation.paymentMethod === paymentMethod
    && validation.semanticFingerprint === buildSubmissionFingerprint(job)
    && job.printcom_order_id == null
    && LIVE_SUBMISSION_STATUSES.has(job.status);
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

function readSupplierResult(record: Record<string, unknown>): { present: boolean; value: string | null } {
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
    if (value === undefined || value === null) continue;
    return {
      present: true,
      value: typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null,
    };
  }
  return { present: false, value: null };
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

function isValidDryRunPayload(value: unknown): boolean {
  const payload = asRecord(value);
  const items = payload.items;
  if (!hasText(payload.customerReference) || !hasPaymentMethod(payload.paymentMethod) || !isNonEmptyRecord(payload.billingAddress)) {
    return false;
  }
  if (!Array.isArray(items) || items.length === 0) return false;

  const firstItem = asRecord(items[0]);
  return hasText(firstItem.sku)
    && typeof firstItem.quantity === "number"
    && Number.isFinite(firstItem.quantity)
    && firstItem.quantity > 0
    && Array.isArray(firstItem.shipments)
    && firstItem.shipments.length > 0
    && isNonEmptyRecord(firstItem.shipments[0]);
}

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return Object.keys(asRecord(value)).length > 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}
