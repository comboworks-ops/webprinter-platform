import assert from "node:assert/strict";
import test from "node:test";

import type { PodFulfillmentJob } from "../pod2/types.ts";
import {
  buildValidationRequest,
  canReconcileUncertainSubmission,
  canConfirmRealSubmission,
  createSubmissionSessionState,
  getProductionOrderPresentation,
  interpretDryRunResult,
  isReconciliationBlocked,
  markSubmissionReconciliationRefreshed,
  reconcileUncertainSubmission,
  resolveCurrentJob,
  startUncertainSubmissionReconciliation,
} from "./orderSubmission.ts";

const VERSION = "2026-07-14T10:00:00.000Z";

function job(overrides: Partial<PodFulfillmentJob> = {}): PodFulfillmentJob {
  return {
    id: "job-1",
    tenant_id: "tenant-1",
    order_id: "order-1",
    order_item_id: "item-1",
    catalog_product_id: "catalog-1",
    variant_signature: "format:a4",
    qty: 100,
    tenant_cost: 100,
    currency: "DKK",
    status: "paid",
    created_at: VERSION,
    updated_at: VERSION,
    ...overrides,
  };
}

function validGate(overrides: Partial<Parameters<typeof canConfirmRealSubmission>[0]> = {}) {
  return {
    jobId: "job-1",
    status: "paid" as const,
    printcomOrderId: null,
    validatedJobId: "job-1",
    validationPassed: true,
    paymentMethod: "invoice" as const,
    validatedPaymentMethod: "invoice" as const,
    jobVersion: VERSION,
    validatedJobVersion: VERSION,
    ...overrides,
  };
}

test("validation always uses dry run", () => {
  assert.deepEqual(buildValidationRequest("job-1", "invoice"), {
    jobId: "job-1",
    paymentMethod: "invoice",
    dryRun: true,
  });
});

test("real send requires every current validation binding", () => {
  assert.equal(canConfirmRealSubmission(validGate()), true);
  assert.equal(canConfirmRealSubmission(validGate({ validatedJobId: "other-job" })), false);
  assert.equal(canConfirmRealSubmission(validGate({ validatedPaymentMethod: "psp" })), false);
  assert.equal(canConfirmRealSubmission(validGate({ validatedJobVersion: "2026-07-14T09:00:00.000Z" })), false);
  assert.equal(canConfirmRealSubmission({ ...validGate(), paymentMethod: "" as never }), false);
  assert.equal(canConfirmRealSubmission({ ...validGate(), jobVersion: "" }), false);
  const omittedBinding = { ...validGate() } as Record<string, unknown>;
  delete omittedBinding.validatedPaymentMethod;
  assert.equal(canConfirmRealSubmission(omittedBinding as never), false);
});

test("stored supplier references always block a real send", () => {
  assert.equal(canConfirmRealSubmission(validGate({ printcomOrderId: "2106321" })), false);
});

test("only approved live statuses can pass the central gate", () => {
  for (const status of ["awaiting_approval", "paid", "processing", "submitted"] as const) {
    assert.equal(canConfirmRealSubmission(validGate({ status })), true);
  }

  for (const status of ["payment_pending", "failed", "completed"] as const) {
    assert.equal(canConfirmRealSubmission(validGate({ status })), false);
  }
});

test("only an explicit clean dry-run contract is green", () => {
  assert.equal(interpretDryRunResult({
    success: true,
    dryRun: true,
    warnings: [],
    payload: { items: [{}] },
  }).kind, "ready");
  assert.equal(interpretDryRunResult({ payload: { items: [{}] } }).kind, "blocked");
  assert.equal(interpretDryRunResult({
    success: true,
    dryRun: false,
    warnings: [],
    payload: { items: [{}] },
  }).kind, "blocked");
  assert.equal(interpretDryRunResult({
    success: true,
    dryRun: true,
    warnings: ["missing mapping"],
    payload: { items: [{}] },
  }).kind, "blocked");
});

test("MANUALCHECK is read only from supplier result fields", () => {
  assert.equal(interpretDryRunResult({
    success: true,
    dryRun: true,
    warnings: [],
    payload: { note: "MANUALCHECK" },
  }).kind, "ready");
  assert.equal(interpretDryRunResult({
    success: true,
    dryRun: true,
    warnings: [],
    payload: { items: [{}] },
    response: { supplierStatus: "MANUALCHECK" },
  }).kind, "manual_check");
});

test("confirmation resolves the current job and rejects a changed supplier reference", () => {
  const openedFor = job();
  const current = job({ updated_at: "2026-07-14T10:01:00.000Z", printcom_order_id: "2106321" });

  assert.equal(resolveCurrentJob([current], openedFor.id), current);
  assert.equal(canConfirmRealSubmission(validGate({
    jobVersion: current.updated_at,
    validatedJobVersion: openedFor.updated_at,
    printcomOrderId: current.printcom_order_id,
  })), false);
});

test("uncertain live submission remains blocked until explicit safe reconciliation", () => {
  const blocked = startUncertainSubmissionReconciliation(createSubmissionSessionState(), "job-1");
  assert.equal(isReconciliationBlocked(blocked, "job-1"), true);

  const failedRefresh = reconcileUncertainSubmission(blocked, {
    jobId: "job-1",
    job: null,
    operatorConfirmedNoSupplierOrder: true,
  });
  assert.equal(isReconciliationBlocked(failedRefresh, "job-1"), true);
  assert.equal(canReconcileUncertainSubmission(blocked, job()), false);

  const storedReference = reconcileUncertainSubmission(blocked, {
    jobId: "job-1",
    job: job({ printcom_order_id: "2106321" }),
    operatorConfirmedNoSupplierOrder: true,
  });
  assert.equal(isReconciliationBlocked(storedReference, "job-1"), true);

  const notConfirmed = reconcileUncertainSubmission(blocked, {
    jobId: "job-1",
    job: job(),
    operatorConfirmedNoSupplierOrder: false,
  });
  assert.equal(isReconciliationBlocked(notConfirmed, "job-1"), true);

  const refreshed = markSubmissionReconciliationRefreshed(blocked, "job-1");
  assert.equal(canReconcileUncertainSubmission(refreshed, job()), true);
  const reconciled = reconcileUncertainSubmission(refreshed, {
    jobId: "job-1",
    job: job(),
    operatorConfirmedNoSupplierOrder: true,
  });
  assert.equal(isReconciliationBlocked(reconciled, "job-1"), false);
});

test("operational presentation is honest about validation and supplier references", () => {
  assert.deepEqual(getProductionOrderPresentation(job()), {
    group: "waiting",
    label: "Afventer kontrol",
    canValidate: true,
    canSubmit: false,
    nextAction: "Kontrollér ordre",
  });
  assert.equal(getProductionOrderPresentation(job(), {
    validation: { jobId: "job-1", jobVersion: VERSION, passed: true, kind: "ready" },
  }).group, "ready");
  assert.equal(getProductionOrderPresentation(job({ status: "failed" }), {
    validation: { jobId: "job-1", jobVersion: VERSION, passed: true, kind: "ready" },
  }).canSubmit, false);
  assert.equal(getProductionOrderPresentation(job({ status: "submitted" })).group, "attention");
  assert.equal(getProductionOrderPresentation(job({ status: "processing" })).group, "attention");
  assert.equal(getProductionOrderPresentation(job({ status: "submitted", printcom_order_id: "2106321" })).group, "supplier");
  assert.equal(getProductionOrderPresentation(job({ status: "completed" })).group, "completed");
  assert.equal(getProductionOrderPresentation(job({ status: "payment_pending" })).group, "waiting");
  assert.equal(getProductionOrderPresentation(job({ status: "awaiting_approval" })).label, "Afventer godkendelse");
  assert.equal(getProductionOrderPresentation(job(), {
    validation: { jobId: "job-1", jobVersion: VERSION, passed: false, kind: "manual_check" },
  }).group, "attention");
  assert.equal(getProductionOrderPresentation(job(), { reconciliationBlocked: true }).group, "attention");
});
