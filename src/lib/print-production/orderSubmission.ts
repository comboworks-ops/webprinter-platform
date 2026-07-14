import type { PodFulfillmentJob } from "../pod2/types.ts";
import { classifyOrder } from "./readiness.ts";
import type { OrderGroup } from "./types.ts";

export type PrintcomPaymentMethod = "invoice" | "psp";

export interface RealSubmissionCheck {
  jobId: string;
  status: PodFulfillmentJob["status"];
  printcomOrderId: string | null | undefined;
  validatedJobId: string | null | undefined;
  validationPassed: boolean;
  paymentMethod?: PrintcomPaymentMethod;
  validatedPaymentMethod?: PrintcomPaymentMethod;
  jobVersion?: string;
  validatedJobVersion?: string;
}

export interface SupplierResponseClassification {
  kind: "ready" | "manual_check";
  label: string;
  description: string;
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
  return !input.printcomOrderId
    && LIVE_SUBMISSION_STATUSES.has(input.status)
    && input.validatedJobId === input.jobId
    && input.validationPassed
    && (!input.paymentMethod || input.paymentMethod === input.validatedPaymentMethod)
    && (!input.jobVersion || input.jobVersion === input.validatedJobVersion);
}

export function classifySupplierResponse(response: unknown): SupplierResponseClassification {
  const serialized = safelySerialize(response).toUpperCase();
  if (serialized.includes("MANUALCHECK")) {
    return {
      kind: "manual_check",
      label: "Leverandøren skal gennemgå filen",
      description: "Leverandøren har modtaget kontrollen, men filen kræver manuel gennemgang før produktion.",
    };
  }

  return {
    kind: "ready",
    label: "Klar til produktion",
    description: "Leverandøren accepterede kontrollen.",
  };
}

export function groupProductionJobs(jobs: PodFulfillmentJob[]): Record<OrderGroup, PodFulfillmentJob[]> {
  const groups: Record<OrderGroup, PodFulfillmentJob[]> = {
    attention: [],
    ready: [],
    supplier: [],
    completed: [],
    waiting: [],
  };

  for (const job of jobs) {
    groups[classifyOrder(job).group].push(job);
  }

  return groups;
}

function safelySerialize(value: unknown): string {
  try {
    return JSON.stringify(value) || "";
  } catch {
    return String(value || "");
  }
}
