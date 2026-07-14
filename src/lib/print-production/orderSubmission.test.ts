import assert from "node:assert/strict";
import test from "node:test";

import {
  buildValidationRequest,
  canConfirmRealSubmission,
  classifySupplierResponse,
} from "./orderSubmission.ts";

test("validation always uses dry run", () => {
  assert.deepEqual(buildValidationRequest("job-1", "invoice"), {
    jobId: "job-1",
    paymentMethod: "invoice",
    dryRun: true,
  });
});

test("real send requires a successful validation for the same job", () => {
  assert.equal(canConfirmRealSubmission({
    jobId: "job-1",
    status: "paid",
    printcomOrderId: null,
    validatedJobId: "job-1",
    validationPassed: true,
  }), true);
  assert.equal(canConfirmRealSubmission({
    jobId: "job-1",
    status: "paid",
    printcomOrderId: "2106321",
    validatedJobId: "job-1",
    validationPassed: true,
  }), false);
});

test("real send is limited to eligible status values", () => {
  for (const status of ["awaiting_approval", "paid", "processing", "submitted"] as const) {
    assert.equal(canConfirmRealSubmission({
      jobId: "job-1",
      status,
      printcomOrderId: null,
      validatedJobId: "job-1",
      validationPassed: true,
    }), true);
  }

  assert.equal(canConfirmRealSubmission({
    jobId: "job-1",
    status: "payment_pending",
    printcomOrderId: null,
    validatedJobId: "job-1",
    validationPassed: true,
  }), false);
});

test("validation cannot be reused for another job", () => {
  assert.equal(canConfirmRealSubmission({
    jobId: "job-2",
    status: "paid",
    printcomOrderId: null,
    validatedJobId: "job-1",
    validationPassed: true,
  }), false);
});

test("stale validation and changed payment method cannot open a real send", () => {
  assert.equal(canConfirmRealSubmission({
    jobId: "job-1",
    status: "paid",
    printcomOrderId: null,
    validatedJobId: "job-1",
    validationPassed: true,
    paymentMethod: "psp",
    validatedPaymentMethod: "invoice",
    jobVersion: "2026-07-14T10:00:00.000Z",
    validatedJobVersion: "2026-07-14T09:00:00.000Z",
  }), false);
});

test("supplier MANUALCHECK stays visible as an amber review state", () => {
  assert.deepEqual(classifySupplierResponse({ status: "MANUALCHECK" }), {
    kind: "manual_check",
    label: "Leverandøren skal gennemgå filen",
    description: "Leverandøren har modtaget kontrollen, men filen kræver manuel gennemgang før produktion.",
  });
});
