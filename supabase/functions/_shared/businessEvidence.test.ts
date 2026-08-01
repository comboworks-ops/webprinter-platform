import assert from "node:assert/strict";
import test from "node:test";

import {
  BusinessEvidenceError,
  type BusinessEvidenceProvider,
  type BusinessEvidenceRepository,
  decideBusinessEvidenceTenantAccess,
  parseBusinessEvidenceRequest,
  processBusinessEvidence,
  savedStructuredCvrMatchesRequest,
} from "./businessEvidence.ts";
import {
  createViesProvider,
  VIES_CHECK_URL,
} from "./providers/viesProvider.ts";
import {
  buildDatafordelerCvrQuery,
  createDanishCompanyProvider,
  DATAFORDELER_CVR_URL,
} from "./providers/danishCompanyProvider.ts";
import {
  createDanishAddressProvider,
  DATAFORDELER_DAR_URL,
} from "./providers/danishAddressProvider.ts";

const NOW = new Date("2026-08-01T08:03:04.000Z");
const TENANT_A = "10000000-0000-4000-8000-000000000001";
const TENANT_B = "20000000-0000-4000-8000-000000000002";
const EVIDENCE_ID = "30000000-0000-4000-8000-000000000003";
const USER_A = "50000000-0000-4000-8000-000000000005";
const RAW_RESPONSE_DIGEST = "a".repeat(64);

function response(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    ...init,
    status: init.status ?? 200,
    headers,
  });
}

test("strict request parsing normalizes VIES inputs separately and bounds Danish address data", () => {
  const vies = parseBusinessEvidenceRequest({
    operation: "vies",
    tenantId: TENANT_A,
    cvr: "12 34-56 78",
  });
  assert.deepEqual(vies, {
    operation: "vies",
    tenantId: TENANT_A,
    providerInput: {
      kind: "vies",
      countryCode: "DK",
      vatNumber: "12345678",
      normalizedIdentifier: "DK12345678",
    },
  });

  const address = parseBusinessEvidenceRequest({
    operation: "danish_address",
    tenantId: TENANT_A,
    query: {
      streetName: " Virksomhedsvej ",
      houseNumber: "12B",
      floor: "2.",
      door: "th",
      postcode: "2100",
      city: " København Ø ",
      country: "dk",
    },
  });
  assert.equal(address.operation, "danish_address");
  assert.equal(address.providerInput.kind, "danish_address");
  if (address.providerInput.kind === "danish_address") {
    assert.equal(address.providerInput.address.streetName, "Virksomhedsvej");
    assert.equal(address.providerInput.address.city, "København Ø");
    assert.equal(address.providerInput.address.country, "DK");
    assert.match(address.providerInput.normalizedIdentifier, /^DKA1:\[/);
  }

  for (
    const bad of [
      { operation: "vies", tenantId: TENANT_A, cvr: "123", extra: true },
      { operation: "danish_company", tenantId: TENANT_A, cvr: "123" },
      { operation: "vies", tenantId: "not-a-uuid", cvr: "12345678" },
      {
        operation: "danish_address",
        tenantId: TENANT_A,
        query: {
          streetName: "Road",
          houseNumber: "1",
          floor: "",
          door: "",
          postcode: "2100",
          city: "City",
          country: "SE",
        },
      },
    ]
  ) {
    assert.throws(
      () => parseBusinessEvidenceRequest(bad),
      (error) =>
        error instanceof BusinessEvidenceError &&
        error.code === "invalid_request",
    );
  }
});

test("versioned address identifiers cannot collide through delimiter injection", () => {
  const first = parseBusinessEvidenceRequest({
    operation: "danish_address",
    tenantId: TENANT_A,
    query: {
      streetName: "a|1",
      houseNumber: "2",
      floor: "x",
      door: "y",
      postcode: "2100",
      city: "z",
      country: "DK",
    },
  });
  const second = parseBusinessEvidenceRequest({
    operation: "danish_address",
    tenantId: TENANT_A,
    query: {
      streetName: "a",
      houseNumber: "1",
      floor: "2",
      door: "x",
      postcode: "2100",
      city: "y|z",
      country: "DK",
    },
  });
  assert.equal(first.providerInput.kind, "danish_address");
  assert.equal(second.providerInput.kind, "danish_address");
  assert.notEqual(
    first.providerInput.normalizedIdentifier,
    second.providerInput.normalizedIdentifier,
  );

  const canonicalReplay = parseBusinessEvidenceRequest({
    operation: "danish_address",
    tenantId: TENANT_A,
    query: {
      streetName: " A|1 ",
      houseNumber: "2",
      floor: "X",
      door: "Y",
      postcode: "2100",
      city: "Z",
      country: "dk",
    },
  });
  assert.equal(
    canonicalReplay.providerInput.normalizedIdentifier,
    first.providerInput.normalizedIdentifier,
  );

  const composed = parseBusinessEvidenceRequest({
    operation: "danish_address",
    tenantId: TENANT_A,
    query: {
      streetName: "Åvej",
      houseNumber: "1",
      floor: "",
      door: "",
      postcode: "2100",
      city: "Köbenhavn",
      country: "DK",
    },
  });
  const decomposed = parseBusinessEvidenceRequest({
    operation: "danish_address",
    tenantId: TENANT_A,
    query: {
      streetName: "A\u030Avej",
      houseNumber: "1",
      floor: "",
      door: "",
      postcode: "2100",
      city: "Ko\u0308benhavn",
      country: "DK",
    },
  });
  assert.equal(
    composed.providerInput.normalizedIdentifier,
    decomposed.providerInput.normalizedIdentifier,
  );
});

test("saved CVR matching requires the exact versioned structured identity", () => {
  const settings = {
    company: {
      cvr: "87654321",
      business_identity_v1: {
        schemaVersion: 1,
        cvrInput: "12 34 56 78",
        normalizedCvr: "12345678",
        viesVatId: "DK12345678",
      },
    },
  };
  const vies = parseBusinessEvidenceRequest({
    operation: "vies",
    tenantId: TENANT_A,
    cvr: "12345678",
  });
  const other = parseBusinessEvidenceRequest({
    operation: "danish_company",
    tenantId: TENANT_A,
    cvr: "87654321",
  });
  assert.equal(savedStructuredCvrMatchesRequest(settings, vies), true);
  assert.equal(savedStructuredCvrMatchesRequest(settings, other), false);
  assert.equal(
    savedStructuredCvrMatchesRequest({ company: { cvr: "12345678" } }, vies),
    false,
  );
});

test("provider orchestration persists minimal display-only evidence and exact replay skips the provider", async () => {
  let verifyCalls = 0;
  let claimCalls = 0;
  let insertedTenant = "";
  let insertedFingerprint = "";
  const provider: BusinessEvidenceProvider = {
    provider: "Fake official provider",
    evidenceType: "vies",
    verify(input, context) {
      verifyCalls += 1;
      assert.equal(input.kind, "vies");
      assert.equal(context.correlationId, "request-1");
      return Promise.resolve({
        schemaVersion: 1,
        provider: "Fake official provider",
        evidenceType: "vies",
        normalizedIdentifier: "DK12345678",
        resultStatus: "valid",
        sourcePayloadSha256: RAW_RESPONSE_DIGEST,
        providerReference: "reference-1",
        checkedAt: NOW.toISOString(),
        displayFields: { vatId: "DK12345678", registeredName: "Example ApS" },
      });
    },
  };
  let storedRow: Parameters<BusinessEvidenceRepository["insert"]>[0] | null =
    null;
  const repository: BusinessEvidenceRepository = {
    findExact(query) {
      assert.equal(query.tenantId, TENANT_A);
      if (!storedRow) return Promise.resolve(null);
      return Promise.resolve({ id: EVIDENCE_ID, ...storedRow });
    },
    claim: () => {
      claimCalls += 1;
      return Promise.resolve(
        storedRow ? { status: "replay" } : { status: "claimed" },
      );
    },
    insert(row) {
      insertedTenant = row.tenantId;
      insertedFingerprint = row.requestFingerprint;
      storedRow = row;
      return Promise.resolve({ status: "inserted", id: EVIDENCE_ID });
    },
  };
  const request = parseBusinessEvidenceRequest({
    operation: "vies",
    tenantId: TENANT_A,
    cvr: "12345678",
  });
  const dependencies = {
    providers: {
      vies: provider,
      danish_company: provider,
      danish_address: provider,
    },
    repository,
    context: {
      fetchImpl: () => Promise.reject(new Error("not used")),
      now: NOW,
      correlationId: "request-1",
    },
  } as const;

  const first = await processBusinessEvidence(request, dependencies);
  assert.equal(first.id, EVIDENCE_ID);
  assert.equal(first.status, "valid");
  assert.equal(first.effect, "display_only");
  assert.equal(first.replayed, false);
  assert.equal(insertedTenant, TENANT_A);
  assert.match(insertedFingerprint, /^[a-f0-9]{64}$/);
  const capturedRow = storedRow as
    | Parameters<BusinessEvidenceRepository["insert"]>[0]
    | null;
  assert.ok(capturedRow);
  assert.equal(capturedRow.responseDigest, RAW_RESPONSE_DIGEST);
  assert.match(capturedRow.evidenceDigest, /^[a-f0-9]{64}$/);
  assert.notEqual(capturedRow.evidenceDigest, capturedRow.responseDigest);
  assert.equal("requestFingerprint" in first, false);
  assert.equal("responseDigest" in first, false);
  assert.equal("normalizedIdentifier" in first, false);

  const replay = await processBusinessEvidence(request, dependencies);
  assert.equal(replay.id, EVIDENCE_ID);
  assert.equal(replay.replayed, true);
  assert.equal(verifyCalls, 1);
  assert.equal(claimCalls, 2);
});

test("repository scope always uses the request tenant and rejects a mismatched stored tenant", async () => {
  const provider: BusinessEvidenceProvider = {
    provider: "EU VIES",
    evidenceType: "vies",
    verify: () => Promise.reject(new Error("must not run")),
  };
  const request = parseBusinessEvidenceRequest({
    operation: "vies",
    tenantId: TENANT_A,
    cvr: "12345678",
  });
  const repository: BusinessEvidenceRepository = {
    findExact: (query) =>
      Promise.resolve({
        id: EVIDENCE_ID,
        tenantId: TENANT_B,
        schemaVersion: 1,
        evidenceType: "vies",
        normalizedIdentifier: "DK12345678",
        provider: "EU VIES",
        resultStatus: "valid",
        providerReference: null,
        checkedAt: NOW.toISOString(),
        receivedAt: NOW.toISOString(),
        requestFingerprint: query.requestFingerprint,
        responseDigest: "0".repeat(64),
        evidenceDigest: "1".repeat(64),
        displayFields: {},
      }),
    claim: () => Promise.resolve({ status: "replay" }),
    insert: () => Promise.reject(new Error("must not insert")),
  };
  await assert.rejects(
    processBusinessEvidence(request, {
      providers: {
        vies: provider,
        danish_company: provider,
        danish_address: provider,
      },
      repository,
      context: {
        fetchImpl: () => Promise.reject(new Error("not used")),
        now: NOW,
        correlationId: "tenant-boundary",
      },
    }),
    (error) =>
      error instanceof BusinessEvidenceError &&
      error.code === "persistence_failed",
  );
});

test("tenant authorization fails closed before existence or provider work for another tenant", async () => {
  let existenceChecks = 0;
  const denied = await decideBusinessEvidenceTenantAccess({
    tenantId: TENANT_B,
    userId: USER_A,
  }, {
    canAccessTenant: (tenantId) => {
      assert.equal(tenantId, TENANT_B);
      return Promise.resolve(false);
    },
    hasExactMasterRole: (userId) => {
      assert.equal(userId, USER_A);
      return Promise.resolve(false);
    },
    tenantExists: () => {
      existenceChecks += 1;
      return Promise.resolve(true);
    },
  });
  assert.deepEqual(denied, { ok: false, reason: "forbidden" });
  assert.equal(existenceChecks, 0);

  const allowed = await decideBusinessEvidenceTenantAccess({
    tenantId: TENANT_A,
    userId: USER_A,
  }, {
    canAccessTenant: (tenantId) => Promise.resolve(tenantId === TENANT_A),
    hasExactMasterRole: () => Promise.reject(new Error("must not run")),
    tenantExists: (tenantId) => Promise.resolve(tenantId === TENANT_A),
  });
  assert.deepEqual(allowed, { ok: true });

  const unavailable = await decideBusinessEvidenceTenantAccess({
    tenantId: TENANT_A,
    userId: USER_A,
  }, {
    canAccessTenant: () => Promise.reject(new Error("database detail")),
    hasExactMasterRole: () => Promise.resolve(false),
    tenantExists: () => Promise.resolve(true),
  });
  assert.deepEqual(unavailable, { ok: false, reason: "unavailable" });
});

test("malformed provider output is persisted only as sanitized unavailable evidence", async () => {
  const inserts: Array<Parameters<BusinessEvidenceRepository["insert"]>[0]> =
    [];
  const malformedProvider: BusinessEvidenceProvider = {
    provider: "EU VIES",
    evidenceType: "vies",
    verify: () =>
      Promise.resolve({
        schemaVersion: 1,
        provider: "EU VIES",
        evidenceType: "vies",
        normalizedIdentifier: "DK12345678",
        resultStatus: "valid",
        sourcePayloadSha256: RAW_RESPONSE_DIGEST,
        providerReference: "secret".repeat(100),
        checkedAt: "not-a-date",
        displayFields: { registeredName: "upstream secret detail" },
      }),
  };
  const result = await processBusinessEvidence(
    parseBusinessEvidenceRequest({
      operation: "vies",
      tenantId: TENANT_A,
      cvr: "12345678",
    }),
    {
      providers: {
        vies: malformedProvider,
        danish_company: malformedProvider,
        danish_address: malformedProvider,
      },
      repository: {
        findExact: () => Promise.resolve(null),
        claim: () => Promise.resolve({ status: "claimed" }),
        insert(row) {
          inserts.push(row);
          return Promise.resolve({ status: "inserted", id: EVIDENCE_ID });
        },
      },
      context: {
        fetchImpl: () => Promise.reject(new Error("not used")),
        now: NOW,
        correlationId: "malformed-provider",
      },
    },
  );
  assert.equal(result.status, "unavailable");
  assert.equal(result.providerReference, null);
  assert.deepEqual(result.displayFields, {});
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].resultStatus, "unavailable");
  assert.doesNotMatch(JSON.stringify(inserts[0]), /secret|upstream/i);
});

test("an atomic in-flight claim prevents simultaneous duplicate provider calls", async () => {
  let providerCalls = 0;
  let releaseProvider!: () => void;
  const providerGate = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  });
  let claimed = false;
  const repository: BusinessEvidenceRepository = {
    findExact: () => Promise.resolve(null),
    claim: () => {
      if (claimed) {
        return Promise.resolve({ status: "in_flight", retryAfterSeconds: 30 });
      }
      claimed = true;
      return Promise.resolve({ status: "claimed" });
    },
    insert: () => Promise.resolve({ status: "inserted", id: EVIDENCE_ID }),
  };
  const provider: BusinessEvidenceProvider = {
    provider: "EU VIES",
    evidenceType: "vies",
    async verify(input) {
      providerCalls += 1;
      await providerGate;
      return {
        schemaVersion: 1,
        provider: "EU VIES",
        evidenceType: "vies",
        normalizedIdentifier: input.normalizedIdentifier,
        resultStatus: "valid",
        sourcePayloadSha256: RAW_RESPONSE_DIGEST,
        providerReference: null,
        checkedAt: NOW.toISOString(),
        displayFields: {},
      };
    },
  };
  const request = parseBusinessEvidenceRequest({
    operation: "vies",
    tenantId: TENANT_A,
    cvr: "12345678",
  });
  const dependencies = {
    providers: {
      vies: provider,
      danish_company: provider,
      danish_address: provider,
    },
    repository,
    context: {
      fetchImpl: () => Promise.reject(new Error("not used")),
      now: NOW,
      correlationId: "concurrent",
    },
  } as const;

  const first = processBusinessEvidence(request, dependencies);
  await Promise.resolve();
  await assert.rejects(
    processBusinessEvidence(request, dependencies),
    (error) =>
      error instanceof BusinessEvidenceError &&
      error.code === "request_in_flight",
  );
  assert.equal(providerCalls, 1);
  releaseProvider();
  await first;
});

test("a rejected quota claim stops provider and persistence work", async () => {
  let providerCalls = 0;
  let insertCalls = 0;
  const provider: BusinessEvidenceProvider = {
    provider: "EU VIES",
    evidenceType: "vies",
    verify: () => {
      providerCalls += 1;
      return Promise.reject(new Error("must not run"));
    },
  };
  await assert.rejects(
    processBusinessEvidence(
      parseBusinessEvidenceRequest({
        operation: "vies",
        tenantId: TENANT_A,
        cvr: "12345678",
      }),
      {
        providers: {
          vies: provider,
          danish_company: provider,
          danish_address: provider,
        },
        repository: {
          findExact: () => Promise.resolve(null),
          claim: () =>
            Promise.resolve({ status: "rate_limited", retryAfterSeconds: 600 }),
          insert: () => {
            insertCalls += 1;
            return Promise.reject(new Error("must not insert"));
          },
        },
        context: {
          fetchImpl: () => Promise.reject(new Error("not used")),
          now: NOW,
          correlationId: "rate-limited",
        },
      },
    ),
    (error) =>
      error instanceof BusinessEvidenceError && error.code === "rate_limited",
  );
  assert.equal(providerCalls, 0);
  assert.equal(insertCalls, 0);
});

test("VIES pins the official REST endpoint and maps valid false to display-only invalid evidence", async () => {
  let observedUrl = "";
  let observedInit: RequestInit | undefined;
  const result = await createViesProvider().verify(
    {
      kind: "vies",
      countryCode: "DK",
      vatNumber: "12345678",
      normalizedIdentifier: "DK12345678",
    },
    {
      now: NOW,
      correlationId: "vies-1",
      fetchImpl(url, init) {
        observedUrl = String(url);
        observedInit = init;
        return Promise.resolve(response({
          countryCode: "DK",
          vatNumber: "12345678",
          requestDate: "2026-08-01T08:03:00.000Z",
          valid: false,
          requestIdentifier: "vies-reference",
          name: "Example ApS",
          address: "Virksomhedsvej 12, 2100 København Ø",
        }));
      },
    },
  );

  assert.equal(
    VIES_CHECK_URL,
    "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number",
  );
  assert.equal(observedUrl, VIES_CHECK_URL);
  assert.equal(observedInit?.method, "POST");
  assert.equal(observedInit?.redirect, "manual");
  assert.equal(observedInit?.signal instanceof AbortSignal, true);
  assert.deepEqual(JSON.parse(String(observedInit?.body)), {
    countryCode: "DK",
    vatNumber: "12345678",
  });
  assert.equal(result.resultStatus, "invalid");
  assert.match(result.sourcePayloadSha256 ?? "", /^[a-f0-9]{64}$/);
  assert.equal(result.providerReference, "vies-reference");
  assert.deepEqual(result.displayFields, {
    vatId: "DK12345678",
    registeredName: "Example ApS",
    registeredAddress: "Virksomhedsvej 12, 2100 København Ø",
  });
});

test("business source evidence hashes exact provider bytes independently of normalized evidence", async () => {
  const providerPayload = {
    countryCode: "DK",
    vatNumber: "12345678",
    requestDate: "2026-08-01T08:03:00.000Z",
    valid: true,
  };
  const compact = JSON.stringify(providerPayload);
  const spaced = JSON.stringify(providerPayload, null, 2);
  const input = {
    kind: "vies" as const,
    countryCode: "DK" as const,
    vatNumber: "12345678",
    normalizedIdentifier: "DK12345678",
  };
  const [first, second] = await Promise.all([
    createViesProvider().verify(input, {
      now: NOW,
      correlationId: "raw-compact",
      fetchImpl: () => Promise.resolve(response(compact)),
    }),
    createViesProvider().verify(input, {
      now: NOW,
      correlationId: "raw-spaced",
      fetchImpl: () => Promise.resolve(response(spaced)),
    }),
  ]);

  assert.equal(first.resultStatus, "valid");
  assert.equal(second.resultStatus, "valid");
  assert.notEqual(first.sourcePayloadSha256, second.sourcePayloadSha256);
  assert.deepEqual(first.displayFields, second.displayFields);
});

test("VIES sanitizes redirects, bad status, malformed or oversized responses as unavailable", async () => {
  const input = {
    kind: "vies" as const,
    countryCode: "DK" as const,
    vatNumber: "12345678",
    normalizedIdentifier: "DK12345678",
  };
  const cases: Array<() => Response | Promise<Response>> = [
    () => response({ secret: "upstream detail" }, { status: 503 }),
    () =>
      new Response("not json", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    () => response("{"),
    () => response("x".repeat(40_000)),
    () => response({ countryCode: "SE", vatNumber: "12345678", valid: true }),
    () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.test" },
      }),
  ];

  for (const makeResponse of cases) {
    const result = await createViesProvider().verify(input, {
      now: NOW,
      correlationId: "vies-bad",
      fetchImpl: () => Promise.resolve(makeResponse()),
    });
    assert.equal(result.resultStatus, "unavailable");
    assert.equal(result.providerReference, null);
    assert.doesNotMatch(JSON.stringify(result), /secret|evil|503|upstream/i);
  }
});

test("official Danish providers are gated without credentials and never fall back to a scraper", async () => {
  let fetchCalls = 0;
  const context = {
    now: NOW,
    correlationId: "gated",
    fetchImpl: () => {
      fetchCalls += 1;
      return Promise.reject(new Error("must not fetch"));
    },
  };
  const company = await createDanishCompanyProvider(null).verify({
    kind: "danish_company",
    cvr: "12345678",
    normalizedIdentifier: "DK12345678",
  }, context);
  const address = await createDanishAddressProvider(null).verify({
    kind: "danish_address",
    normalizedIdentifier: "DK|2100|virksomhedsvej|12||||københavn ø",
    address: {
      streetName: "Virksomhedsvej",
      houseNumber: "12",
      floor: "",
      door: "",
      postcode: "2100",
      city: "København Ø",
      country: "DK",
    },
  }, context);
  assert.equal(company.resultStatus, "unavailable");
  assert.equal(address.resultStatus, "unavailable");
  assert.equal(fetchCalls, 0);
  assert.equal(DATAFORDELER_CVR_URL, "https://graphql.datafordeler.dk/CVR/v2");
  assert.equal(DATAFORDELER_DAR_URL, "https://graphql.datafordeler.dk/DAR/v3");
});

test("official CVR adapter uses the fixed Datafordeler endpoint and minimal company fields", async () => {
  let observedUrl = "";
  let observedBody = "";
  let observedAuthorization = "";
  const result = await createDanishCompanyProvider({
    kind: "bearer",
    value: "reviewed-access-token-value",
  }).verify({
    kind: "danish_company",
    cvr: "12345678",
    normalizedIdentifier: "DK12345678",
  }, {
    now: NOW,
    correlationId: "cvr-1",
    fetchImpl(url, init) {
      observedUrl = String(url);
      observedBody = String(init?.body);
      observedAuthorization = new Headers(init?.headers).get("authorization") ??
        "";
      return Promise.resolve(response({
        data: {
          CVR_Virksomhed: {
            nodes: [{
              id: "company-reference",
              CVRNummer: "12345678",
              status: "aktiv",
              virksomhedStartdato: "2020-01-02",
              virksomhedOphoersdato: null,
            }],
          },
        },
      }));
    },
  });

  assert.equal(observedUrl, DATAFORDELER_CVR_URL);
  assert.equal(observedAuthorization, "Bearer reviewed-access-token-value");
  assert.match(observedBody, /CVR_Virksomhed/);
  assert.match(observedBody, /CVRNummer/);
  assert.doesNotMatch(observedBody, /Person|deltager|email|telefon/i);
  assert.equal(
    JSON.parse(observedBody).query,
    `query CurrentCompany {
  CVR_Virksomhed(
    first: 1
    virkningstid: "2026-08-01T08:03:04.000Z"
    where: { CVRNummer: { eq: "12345678" } }
  ) {
    nodes {
      id
      CVRNummer
      status
      virksomhedStartdato
      virksomhedOphoersdato
    }
  }
}`,
  );
  assert.equal(
    buildDatafordelerCvrQuery("12345678", NOW),
    JSON.parse(observedBody).query,
  );
  assert.doesNotMatch(observedBody, /registreringstid/);
  assert.equal(result.resultStatus, "valid");
  assert.equal(result.providerReference, "company-reference");
  assert.deepEqual(result.displayFields, {
    cvr: "12345678",
    status: "aktiv",
    startDate: "2020-01-02",
    endDate: null,
  });

  const duplicateNestedKey = await createDanishCompanyProvider({
    kind: "bearer",
    value: "reviewed-access-token-value",
  }).verify({
    kind: "danish_company",
    cvr: "12345678",
    normalizedIdentifier: "DK12345678",
  }, {
    now: NOW,
    correlationId: "cvr-duplicate",
    fetchImpl: () =>
      Promise.resolve(response(
        '{"data":{"CVR_Virksomhed":{"nodes":[],"nodes":[{"CVRNummer":"12345678"}]}}}',
      )),
  });
  assert.equal(duplicateNestedKey.resultStatus, "unavailable");
});

test("official DAR adapter uses exact structured input and rejects ambiguous matches", async () => {
  let observedUrl = "";
  let observedBody = "";
  const input = {
    kind: "danish_address" as const,
    normalizedIdentifier: "DK|2100|virksomhedsvej|12|2.|th|københavn ø",
    address: {
      streetName: "Virksomhedsvej",
      houseNumber: "12",
      floor: "2.",
      door: "th",
      postcode: "2100",
      city: "København Ø",
      country: "DK" as const,
    },
  };
  const provider = createDanishAddressProvider({
    kind: "api_key",
    value: "reviewed-datafordeler-api-key",
  });
  const result = await provider.verify(input, {
    now: NOW,
    correlationId: "dar-1",
    fetchImpl(url, init) {
      observedUrl = String(url);
      observedBody = String(init?.body);
      return Promise.resolve(response({
        data: {
          DAR_Adresse: {
            nodes: [{
              id_lokalId: "40000000-0000-4000-8000-000000000004",
              adressebetegnelse: "Virksomhedsvej 12, 2. th, 2100 København Ø",
              etagebetegnelse: "2.",
              doerbetegnelse: "th",
              status: "3",
            }],
          },
        },
      }));
    },
  });
  assert.match(
    observedUrl,
    /^https:\/\/graphql\.datafordeler\.dk\/DAR\/v3\?apiKey=/,
  );
  assert.equal(observedUrl.includes("reviewed-datafordeler-api-key"), true);
  assert.match(observedBody, /DAR_Adresse/);
  assert.match(observedBody, /adressebetegnelse/);
  assert.match(observedBody, /id_lokalId/);
  assert.doesNotMatch(observedBody, /Adressevælger|DAWA|api\.dataforsyningen/i);
  assert.equal(result.resultStatus, "valid");
  assert.equal(
    result.providerReference,
    "40000000-0000-4000-8000-000000000004",
  );
  assert.equal(result.displayFields.streetName, "Virksomhedsvej");
  assert.equal(
    result.displayFields.officialAddress,
    "Virksomhedsvej 12, 2. th, 2100 København Ø",
  );

  const ambiguous = await provider.verify(input, {
    now: NOW,
    correlationId: "dar-ambiguous",
    fetchImpl: () =>
      Promise.resolve(response({
        data: {
          DAR_Adresse: {
            nodes: [
              { id_lokalId: "a", adressebetegnelse: "one", status: "3" },
              { id_lokalId: "b", adressebetegnelse: "two", status: "3" },
            ],
          },
        },
      })),
  });
  assert.equal(ambiguous.resultStatus, "unavailable");
  assert.equal(ambiguous.providerReference, null);
});

test("shared contract contains no authoritative tenant, checkout, price, invoice, POD, or order writer", () => {
  const source = String(processBusinessEvidence);
  assert.doesNotMatch(
    source,
    /\.from\(["'](?:tenants|orders|products|prices|invoices|pod)/i,
  );
  assert.doesNotMatch(
    source,
    /changesVat:\s*true|changesCheckout:\s*true|changesTenantAccess:\s*true/,
  );
});
