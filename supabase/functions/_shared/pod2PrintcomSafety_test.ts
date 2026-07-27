import {
  assertEquals,
  assertNotEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildPrintcomUrl,
  constantTimeEqual,
  fingerprintSubmissionPayload,
  getSubmissionEligibility,
  isSafeSupplierStatusTransition,
  normalizeJobIds,
  normalizePrintcomBaseUrl,
  parseSubmissionRequest,
  shouldReleaseSubmissionClaim,
  validateSubmissionPayload,
} from "./pod2PrintcomSafety.ts";

const JOB_ID = "8a3db8e9-61ce-4b37-a853-f861fa39ce17";
const ELIGIBLE_JOB = {
  id: JOB_ID,
  status: "paid",
  qty: 100,
  tenant_cost: 100,
  currency: "DKK",
};

function payload() {
  return {
    customerReference: `wp-${JOB_ID}`,
    paymentMethod: "invoice",
    billingAddress: {
      companyName: "Webprinter",
      firstName: "Web",
      lastName: "Printer",
      fullstreet: "Testvej",
      houseNumber: "1",
      postcode: "8000",
      city: "Aarhus",
      country: "DK",
      email: "info@webprinter.dk",
    },
    items: [{
      sku: "flyer-a4",
      options: { paper: "130g", copies: "100" },
      quantity: 100,
      fileUrl: "https://files.webprinter.dk/order.pdf",
      shipments: [{
        quantity: 100,
        address: {
          companyName: "Kunde",
          firstName: "Ada",
          fullstreet: "Kundegade",
          houseNumber: "2",
          postcode: "2100",
          city: "Kobenhavn",
          country: "DK",
          email: "ada@example.dk",
        },
      }],
    }],
  };
}

Deno.test("submission requests are bounded and typed", () => {
  assertEquals(parseSubmissionRequest({ jobId: JOB_ID, dryRun: true }), {
    jobId: JOB_ID,
    paymentMethod: "invoice",
    dryRun: true,
  });
  assertThrows(() => parseSubmissionRequest({ jobId: "job-1" }));
  assertThrows(() =>
    parseSubmissionRequest({ jobId: JOB_ID, paymentMethod: "cash" })
  );
  assertThrows(() => parseSubmissionRequest({ jobId: JOB_ID, dryRun: "yes" }));
});

Deno.test("only paid jobs with server payment evidence can submit", () => {
  assertEquals(
    getSubmissionEligibility({
      job: { ...ELIGIBLE_JOB, stripe_payment_intent_id: "pi_123" },
      tenantAutoForward: false,
    }),
    { ok: true, paymentVerification: "stripe" },
  );
  assertEquals(
    getSubmissionEligibility({
      job: ELIGIBLE_JOB,
      tenantAutoForward: true,
    }),
    { ok: true, paymentVerification: "auto_forward" },
  );
  assertEquals(
    getSubmissionEligibility({
      job: { ...ELIGIBLE_JOB, status: "awaiting_approval" },
      tenantAutoForward: true,
    }).ok,
    false,
  );
  assertEquals(
    getSubmissionEligibility({
      job: ELIGIBLE_JOB,
      tenantAutoForward: false,
    }).ok,
    false,
  );
  assertEquals(
    getSubmissionEligibility({
      job: {
        ...ELIGIBLE_JOB,
        tenant_cost: 0,
        stripe_payment_intent_id: "pi_123",
      },
      tenantAutoForward: false,
    }).ok,
    false,
  );
});

Deno.test("stored references and locks block duplicate submission", () => {
  for (
    const job of [
      {
        ...ELIGIBLE_JOB,
        stripe_payment_intent_id: "pi_123",
        printcom_order_id: "pc-1",
      },
      {
        ...ELIGIBLE_JOB,
        stripe_payment_intent_id: "pi_123",
        provider_job_ref: "manual-1",
      },
      {
        ...ELIGIBLE_JOB,
        stripe_payment_intent_id: "pi_123",
        printcom_submission_lock_token: JOB_ID,
      },
    ]
  ) {
    assertEquals(
      getSubmissionEligibility({ job, tenantAutoForward: false }).ok,
      false,
    );
  }
});

Deno.test("Print.com URLs cannot escape the approved API origins", () => {
  assertEquals(
    normalizePrintcomBaseUrl("https://api.print.com/v1"),
    "https://api.print.com",
  );
  assertEquals(
    buildPrintcomUrl("https://api.print.com", "/orders").toString(),
    "https://api.print.com/orders",
  );
  assertThrows(() => normalizePrintcomBaseUrl("http://api.print.com"));
  assertThrows(() => normalizePrintcomBaseUrl("https://example.com"));
  assertThrows(() =>
    buildPrintcomUrl("https://api.print.com", "https://example.com/orders")
  );
  assertThrows(() =>
    buildPrintcomUrl("https://api.print.com", "//example.com/orders")
  );
});

Deno.test("strict payload validation accepts complete print data", () => {
  assertEquals(
    validateSubmissionPayload({
      payload: payload(),
      expectedJobId: JOB_ID,
      warnings: [],
    }),
    [],
  );
});

Deno.test("strict payload validation blocks warnings, private URLs, and missing addresses", () => {
  const invalid = payload();
  invalid.items[0].fileUrl = "https://127.0.0.1/order.pdf";
  invalid.items[0].shipments[0].address.houseNumber = "";
  const errors = validateSubmissionPayload({
    payload: invalid,
    expectedJobId: JOB_ID,
    warnings: ["missing map"],
  });
  assertEquals(
    errors.includes("Supplier option mapping contains warnings"),
    true,
  );
  assertEquals(
    errors.includes("Print file URL must be a public HTTPS URL"),
    true,
  );
  assertEquals(errors.includes("Recipient house number is missing"), true);
});

Deno.test("payload fingerprints are canonical and bind value changes", async () => {
  const first = await fingerprintSubmissionPayload({ b: 2, a: { y: 2, x: 1 } });
  const reordered = await fingerprintSubmissionPayload({
    a: { x: 1, y: 2 },
    b: 2,
  });
  const changed = await fingerprintSubmissionPayload({
    a: { x: 1, y: 3 },
    b: 2,
  });
  assertEquals(first, reordered);
  assertNotEquals(first, changed);
});

Deno.test("status synchronization cannot regress or reopen terminal jobs", () => {
  assertEquals(isSafeSupplierStatusTransition("submitted", "processing"), true);
  assertEquals(isSafeSupplierStatusTransition("processing", "completed"), true);
  assertEquals(
    isSafeSupplierStatusTransition("processing", "submitted"),
    false,
  );
  assertEquals(
    isSafeSupplierStatusTransition("completed", "processing"),
    false,
  );
  assertEquals(isSafeSupplierStatusTransition("failed", "submitted"), false);
});

Deno.test("job ID lists are unique, valid, and bounded", () => {
  assertEquals(normalizeJobIds([JOB_ID, JOB_ID]), [JOB_ID]);
  assertThrows(() => normalizeJobIds(["not-a-uuid"]));
  assertThrows(() =>
    normalizeJobIds(
      Array.from({ length: 51 }, (_, index) =>
        `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`),
    )
  );
});

Deno.test("only definitive HTTP rejection releases an atomic claim", () => {
  assertEquals(shouldReleaseSubmissionClaim(400), true);
  assertEquals(shouldReleaseSubmissionClaim(422), true);
  assertEquals(shouldReleaseSubmissionClaim(409), false);
  assertEquals(shouldReleaseSubmissionClaim(429), false);
  assertEquals(shouldReleaseSubmissionClaim(500), false);
});

Deno.test("cron secret comparison handles equal and different lengths", () => {
  assertEquals(constantTimeEqual("same-secret", "same-secret"), true);
  assertEquals(constantTimeEqual("same-secret", "different"), false);
  assertEquals(constantTimeEqual("short", "shorter"), false);
});
