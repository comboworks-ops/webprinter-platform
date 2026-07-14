import assert from "node:assert/strict";
import test from "node:test";

import type { PodFulfillmentJob } from "../pod2/types.ts";
import {
  buildSubmissionFingerprint,
  buildValidationRequest,
  canReconcileUncertainSubmission,
  canConfirmRealSubmission,
  createSubmissionSessionState,
  getProductionOrderPresentation,
  getValidationOutcomeState,
  interpretDryRunResult,
  isReconciliationBlocked,
  markSubmissionReconciliationRefreshed,
  reconcileUncertainSubmission,
  resolveCurrentJob,
  resolvePendingValidation,
  startUncertainSubmissionReconciliation,
  summarizeDryRunPayload,
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
    currentSemanticFingerprint: buildSubmissionFingerprint(job()),
    validatedSemanticFingerprint: buildSubmissionFingerprint(job()),
    ...overrides,
  };
}

function dryRunPayload(overrides: Record<string, unknown> = {}) {
  return {
    customerReference: "wp-job-1",
    paymentMethod: "invoice",
    billingAddress: { companyName: "WebPrinter" },
    items: [{
      sku: "flyer-a4",
      quantity: 100,
      shipments: [{ quantity: 100, address: { city: "Kobenhavn" } }],
      options: { paper: "130g", print: "4-4" },
    }],
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
  for (const field of ["validatedPaymentMethod", "validatedJobVersion", "currentSemanticFingerprint", "validatedSemanticFingerprint"]) {
    const omittedBinding = { ...validGate() } as Record<string, unknown>;
    delete omittedBinding[field];
    assert.equal(canConfirmRealSubmission(omittedBinding as never), false);
  }
});

test("stored supplier references always block a real send", () => {
  assert.equal(canConfirmRealSubmission(validGate({ printcomOrderId: "2106321" })), false);
});

test("semantic submission fingerprints ignore tracking but bind all submission-relevant job state", () => {
  const base = job({
    product_id: "product-1",
    product_name: "Flyer",
    recipient_name: "Ada Andersen",
    delivery_summary: "Levering til doren",
    sender_mode: "custom",
    sender_name: "Butik A",
    sender_address_json: { city: "Aarhus", country: "DK" },
  });
  const fingerprint = buildSubmissionFingerprint(base);

  assert.equal(buildSubmissionFingerprint(base), buildSubmissionFingerprint({
    ...base,
    updated_at: "2026-07-14T10:01:00.000Z",
    printcom_last_attempt_at: "2026-07-14T10:01:00.000Z",
    printcom_last_error: "temporary diagnostic",
  }));
  for (const changed of [
    { qty: 101 },
    { variant_signature: "format:a5" },
    { recipient_name: "Bea Berg" },
    { delivery_summary: "Afhentning" },
    { tenant_cost: 101 },
    { sender_name: "Butik B" },
    { product_name: "Plakat" },
    { status: "processing" as const },
    { printcom_order_id: "2106321" },
  ]) {
    assert.notEqual(buildSubmissionFingerprint({ ...base, ...changed }), fingerprint);
  }
});

test("central live gate requires the exact validated semantic fingerprint", () => {
  assert.equal(canConfirmRealSubmission(validGate({ validatedSemanticFingerprint: "other" })), false);
  const omittedBinding = { ...validGate() } as Record<string, unknown>;
  delete omittedBinding.currentSemanticFingerprint;
  assert.equal(canConfirmRealSubmission(omittedBinding as never), false);
});

test("pending validation uses an absolute deadline for refresh binding", () => {
  const before = job();
  const pending = {
    jobId: before.id,
    preValidationVersion: before.updated_at,
    preValidationFingerprint: buildSubmissionFingerprint(before),
    deadlineAt: 10_000,
  };

  assert.equal(resolvePendingValidation({ pending, currentJob: before, now: 9_000 }).kind, "waiting");
  assert.equal(resolvePendingValidation({
    pending,
    currentJob: job({ updated_at: "2026-07-14T10:01:00.000Z", printcom_last_attempt_at: "2026-07-14T10:01:00.000Z" }),
    now: 9_000,
  }).kind, "accepted");
  assert.equal(resolvePendingValidation({ pending, currentJob: before, now: 10_000 }).kind, "rejected");
  assert.equal(resolvePendingValidation({
    pending,
    currentJob: job({ updated_at: "2026-07-14T10:01:00.000Z", printcom_last_attempt_at: "2026-07-14T10:01:00.000Z" }),
    now: 10_000,
  }).kind, "rejected");

  assert.equal(resolvePendingValidation({ pending, currentJob: before, now: 9_250 }).kind, "waiting");
  assert.equal(resolvePendingValidation({ pending, currentJob: before, now: 9_750 }).kind, "waiting");
  assert.equal(pending.deadlineAt, 10_000);
  assert.equal(resolvePendingValidation({
    pending,
    currentJob: job({ updated_at: "2026-07-14T10:01:00.000Z", qty: 101 }),
    now: 9_000,
  }).kind, "rejected");
  assert.equal(resolvePendingValidation({
    pending,
    currentJob: job({ updated_at: "2026-07-14T10:01:00.000Z", printcom_order_id: "2106321" }),
    now: 9_000,
  }).kind, "rejected");
  assert.equal(resolvePendingValidation({
    pending,
    currentJob: job({ updated_at: "2026-07-14T10:01:00.000Z", status: "failed" }),
    now: 9_000,
  }).kind, "rejected");
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
    payload: dryRunPayload(),
  }).kind, "ready");
  assert.equal(interpretDryRunResult({ payload: dryRunPayload() }).kind, "blocked");
  assert.equal(interpretDryRunResult({
    success: true,
    dryRun: false,
    warnings: [],
    payload: dryRunPayload(),
  }).kind, "blocked");
  assert.equal(interpretDryRunResult({
    success: true,
    dryRun: true,
    warnings: ["missing mapping"],
    payload: dryRunPayload(),
  }).kind, "blocked");
  assert.equal(interpretDryRunResult({ success: true, dryRun: true, warnings: [], payload: { items: [{}] } }).kind, "blocked");
  assert.equal(interpretDryRunResult({ success: true, dryRun: true, warnings: [], payload: dryRunPayload({ items: [] }) }).kind, "blocked");
});

test("MANUALCHECK is read only from supplier result fields", () => {
  assert.equal(interpretDryRunResult({
    success: true,
    dryRun: true,
    warnings: [],
    payload: dryRunPayload({ note: "MANUALCHECK" }),
  }).kind, "ready");
  assert.equal(interpretDryRunResult({
    success: true,
    dryRun: true,
    warnings: [],
    payload: dryRunPayload(),
    response: { supplierStatus: "MANUALCHECK" },
  }).kind, "manual_check");
  for (const supplierStatus of ["ERROR", "REJECTED", "FAILED", "PENDING"] as const) {
    assert.equal(interpretDryRunResult({
      success: true,
      dryRun: true,
      warnings: [],
      payload: dryRunPayload(),
      response: { supplierStatus },
    }).kind, "blocked");
  }
  assert.equal(interpretDryRunResult({
    success: true,
    dryRun: true,
    warnings: [],
    payload: dryRunPayload(),
    response: { supplierStatus: "SUCCESS" },
  }).kind, "ready");
  assert.equal(interpretDryRunResult({
    success: true,
    dryRun: true,
    warnings: [],
    payload: dryRunPayload(),
    response: { supplierStatus: { state: "SUCCESS" } },
  }).kind, "blocked");
});

test("safe dry-run summary exposes counts without raw option mappings", () => {
  assert.equal(summarizeDryRunPayload(dryRunPayload()), "1 vare · 100 stk. · 2 valg");
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
    validation: { jobId: "job-1", jobVersion: VERSION, paymentMethod: "invoice", semanticFingerprint: buildSubmissionFingerprint(job()), passed: true, kind: "ready" },
    paymentMethod: "invoice",
  }).group, "ready");
  assert.equal(getProductionOrderPresentation(job({ status: "failed" }), {
    validation: { jobId: "job-1", jobVersion: VERSION, paymentMethod: "invoice", semanticFingerprint: buildSubmissionFingerprint(job({ status: "failed" })), passed: true, kind: "ready" },
    paymentMethod: "invoice",
  }).canSubmit, false);
  assert.equal(getProductionOrderPresentation(job({ status: "submitted" })).group, "attention");
  assert.equal(getProductionOrderPresentation(job({ status: "processing" })).group, "attention");
  assert.equal(getProductionOrderPresentation(job({ status: "submitted", printcom_order_id: "2106321" })).group, "supplier");
  assert.equal(getProductionOrderPresentation(job({ status: "completed" })).group, "completed");
  assert.equal(getProductionOrderPresentation(job({ status: "payment_pending" })).group, "waiting");
  assert.equal(getProductionOrderPresentation(job({ status: "awaiting_approval" })).label, "Afventer godkendelse");
  assert.equal(getProductionOrderPresentation(job(), {
    validation: { jobId: "job-1", jobVersion: VERSION, paymentMethod: "invoice", semanticFingerprint: buildSubmissionFingerprint(job()), passed: false, kind: "manual_check" },
    paymentMethod: "invoice",
  }).group, "attention");
  assert.equal(getProductionOrderPresentation(job(), { reconciliationBlocked: true }).group, "attention");
  for (const status of ["processing", "submitted"] as const) {
    const current = job({ status });
    assert.equal(getProductionOrderPresentation(current, { paymentMethod: "invoice" }).group, "attention");
    assert.deepEqual(getProductionOrderPresentation(current, {
      paymentMethod: "invoice",
      validation: { jobId: current.id, jobVersion: current.updated_at, paymentMethod: "invoice", semanticFingerprint: buildSubmissionFingerprint(current), passed: true, kind: "ready" },
    }), {
      group: "ready",
      label: "Klar til produktion",
      canValidate: true,
      canSubmit: true,
      nextAction: "Bekræft leverandørordre",
    });
  }
});

test("green validation outcome requires a current eligible semantic binding", () => {
  const current = job();
  const validation = {
    jobId: current.id,
    jobVersion: current.updated_at,
    paymentMethod: "invoice" as const,
    semanticFingerprint: buildSubmissionFingerprint(current),
    passed: true,
    kind: "ready" as const,
  };
  assert.equal(getValidationOutcomeState(current, validation, "invoice"), "ready");
  assert.equal(getValidationOutcomeState({ ...current, qty: 101 }, validation, "invoice"), "stale");
  assert.equal(getValidationOutcomeState({ ...current, status: "failed" }, validation, "invoice"), "stale");
  assert.equal(getValidationOutcomeState(current, validation, "psp"), "stale");
});
