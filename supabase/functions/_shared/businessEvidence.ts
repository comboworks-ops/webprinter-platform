export const BUSINESS_EVIDENCE_SCHEMA_VERSION = 1 as const;
export const BUSINESS_PROVIDER_TIMEOUT_MS = 5_000;
export const BUSINESS_PROVIDER_MAX_BODY_BYTES = 32 * 1024;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const ISO_INSTANT_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const EVIDENCE_BUCKET_MS = 5 * 60 * 1_000;
const DANISH_ADDRESS_IDENTIFIER_VERSION = "DKA1";

export type BusinessEvidenceOperation =
  | "vies"
  | "danish_company"
  | "danish_address";
export type BusinessEvidenceType = BusinessEvidenceOperation;
export type BusinessEvidenceResultStatus =
  | "unknown"
  | "pending"
  | "valid"
  | "invalid"
  | "unavailable"
  | "stale";

export type DanishAddressInput = Readonly<{
  streetName: string;
  houseNumber: string;
  floor: string;
  door: string;
  postcode: string;
  city: string;
  country: "DK";
}>;

export type ViesProviderInput = Readonly<{
  kind: "vies";
  countryCode: "DK";
  vatNumber: string;
  normalizedIdentifier: string;
}>;

export type DanishCompanyProviderInput = Readonly<{
  kind: "danish_company";
  cvr: string;
  normalizedIdentifier: string;
}>;

export type DanishAddressProviderInput = Readonly<{
  kind: "danish_address";
  address: DanishAddressInput;
  normalizedIdentifier: string;
}>;

export type BusinessEvidenceProviderInput =
  | ViesProviderInput
  | DanishCompanyProviderInput
  | DanishAddressProviderInput;

export type ParsedBusinessEvidenceRequest = Readonly<{
  operation: BusinessEvidenceOperation;
  tenantId: string;
  providerInput: BusinessEvidenceProviderInput;
}>;

export type ProviderDisplayFields = Readonly<
  Record<string, string | boolean | null>
>;

export type BusinessProviderEvidence = Readonly<{
  schemaVersion: 1;
  provider: string;
  evidenceType: BusinessEvidenceType;
  normalizedIdentifier: string;
  resultStatus: "valid" | "invalid" | "unavailable";
  sourcePayloadSha256: string | null;
  providerReference: string | null;
  checkedAt: string;
  displayFields: ProviderDisplayFields;
}>;

export type ProviderContext = Readonly<{
  fetchImpl: FetchLike;
  now: Date;
  correlationId: string;
}>;

export type BusinessEvidenceProvider = Readonly<{
  provider: string;
  evidenceType: BusinessEvidenceType;
  verify: (
    input: BusinessEvidenceProviderInput,
    context: ProviderContext,
  ) => Promise<BusinessProviderEvidence>;
}>;

export type BusinessEvidenceInsert = Readonly<{
  tenantId: string;
  schemaVersion: 1;
  evidenceType: BusinessEvidenceType;
  normalizedIdentifier: string;
  provider: string;
  resultStatus: BusinessEvidenceResultStatus;
  providerReference: string | null;
  checkedAt: string;
  receivedAt: string;
  requestFingerprint: string;
  responseDigest: string | null;
  evidenceDigest: string;
  displayFields: ProviderDisplayFields;
}>;

export type StoredBusinessEvidence =
  & BusinessEvidenceInsert
  & Readonly<{ id: string }>;

export type BusinessEvidenceRepository = Readonly<{
  findExact: (
    query: Readonly<{
      tenantId: string;
      provider: string;
      requestFingerprint: string;
    }>,
  ) => Promise<StoredBusinessEvidence | null>;
  claim: (
    query: Readonly<{
      tenantId: string;
      operation: BusinessEvidenceOperation;
      provider: string;
      requestFingerprint: string;
    }>,
  ) => Promise<
    | Readonly<{ status: "claimed" | "replay" }>
    | Readonly<{
      status: "in_flight" | "rate_limited";
      retryAfterSeconds: number;
    }>
  >;
  insert: (
    row: BusinessEvidenceInsert,
  ) => Promise<
    | Readonly<{ status: "inserted"; id: string }>
    | Readonly<{ status: "conflict" }>
  >;
}>;

export type BusinessEvidenceDisplayDto = Readonly<{
  id: string;
  schemaVersion: 1;
  evidenceType: BusinessEvidenceType;
  status: BusinessEvidenceResultStatus;
  provider: string;
  providerReference: string | null;
  checkedAt: string;
  displayFields: ProviderDisplayFields;
  replayed: boolean;
  effect: "display_only";
}>;

export type BusinessEvidenceAccessDecision =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: "forbidden" | "not_found" | "unavailable" }>;

export type BusinessEvidenceErrorCode =
  | "invalid_request"
  | "provider_unavailable"
  | "persistence_failed"
  | "rate_limited"
  | "request_in_flight";

const ERROR_MESSAGES: Record<BusinessEvidenceErrorCode, string> = {
  invalid_request: "Invalid business-evidence request",
  provider_unavailable: "Business-evidence provider is unavailable",
  persistence_failed: "Business evidence could not be stored",
  rate_limited: "Business-evidence request rate exceeded",
  request_in_flight: "An equivalent business-evidence request is in flight",
};

export class BusinessEvidenceError extends Error {
  readonly code: BusinessEvidenceErrorCode;
  readonly retryAfterSeconds: number | null;

  constructor(code: BusinessEvidenceErrorCode, retryAfterSeconds?: number) {
    super(ERROR_MESSAGES[code]);
    this.name = "BusinessEvidenceError";
    this.code = code;
    this.retryAfterSeconds = Number.isSafeInteger(retryAfterSeconds) &&
        Number(retryAfterSeconds) >= 1 && Number(retryAfterSeconds) <= 3_600
      ? Number(retryAfterSeconds)
      : null;
  }
}

export async function decideBusinessEvidenceTenantAccess(
  input: Readonly<{ tenantId: string; userId: string }>,
  dependencies: Readonly<{
    canAccessTenant: (tenantId: string) => Promise<boolean>;
    hasExactMasterRole: (userId: string) => Promise<boolean>;
    tenantExists: (tenantId: string) => Promise<boolean>;
  }>,
): Promise<BusinessEvidenceAccessDecision> {
  if (!isUuid(input?.tenantId) || !isUuid(input?.userId)) {
    return Object.freeze({ ok: false, reason: "unavailable" });
  }
  try {
    let authorized = await dependencies.canAccessTenant(input.tenantId);
    if (typeof authorized !== "boolean") {
      throw new Error("invalid access decision");
    }
    if (!authorized) {
      authorized = await dependencies.hasExactMasterRole(input.userId);
      if (typeof authorized !== "boolean") {
        throw new Error("invalid role decision");
      }
    }
    if (!authorized) return Object.freeze({ ok: false, reason: "forbidden" });
    const exists = await dependencies.tenantExists(input.tenantId);
    if (typeof exists !== "boolean") throw new Error("invalid tenant decision");
    return exists
      ? Object.freeze({ ok: true })
      : Object.freeze({ ok: false, reason: "not_found" });
  } catch {
    return Object.freeze({ ok: false, reason: "unavailable" });
  }
}

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export function parseBusinessEvidenceRequest(
  input: unknown,
): ParsedBusinessEvidenceRequest {
  try {
    if (!isPlainRecord(input)) throw invalidRequest();
    const operation = input.operation;
    const tenantId = input.tenantId;
    if (!isBusinessOperation(operation) || !isUuid(tenantId)) {
      throw invalidRequest();
    }

    if (operation === "vies" || operation === "danish_company") {
      assertExactKeys(input, ["operation", "tenantId", "cvr"]);
      const cvr = normalizeCvr(input.cvr);
      const providerInput = operation === "vies"
        ? deepFreeze({
          kind: "vies" as const,
          countryCode: "DK" as const,
          vatNumber: cvr,
          normalizedIdentifier: `DK${cvr}`,
        })
        : deepFreeze({
          kind: "danish_company" as const,
          cvr,
          normalizedIdentifier: `DK${cvr}`,
        });
      return deepFreeze({ operation, tenantId, providerInput });
    }

    assertExactKeys(input, ["operation", "tenantId", "query"]);
    const address = normalizeDanishAddress(input.query);
    const normalizedIdentifier = `${DANISH_ADDRESS_IDENTIFIER_VERSION}:${
      JSON.stringify([
        address.postcode,
        canonicalAddressIdentifierComponent(address.streetName),
        canonicalAddressIdentifierComponent(address.houseNumber),
        canonicalAddressIdentifierComponent(address.floor),
        canonicalAddressIdentifierComponent(address.door),
        canonicalAddressIdentifierComponent(address.city),
      ])
    }`;
    if (normalizedIdentifier.length > 256) throw invalidRequest();
    return deepFreeze({
      operation,
      tenantId,
      providerInput: {
        kind: "danish_address" as const,
        address,
        normalizedIdentifier,
      },
    });
  } catch {
    throw invalidRequest();
  }
}

export async function processBusinessEvidence(
  request: ParsedBusinessEvidenceRequest,
  dependencies: Readonly<{
    providers: Readonly<
      Record<BusinessEvidenceOperation, BusinessEvidenceProvider>
    >;
    repository: BusinessEvidenceRepository;
    context: ProviderContext;
  }>,
): Promise<BusinessEvidenceDisplayDto> {
  try {
    const normalizedRequest = validateParsedRequest(request);
    const provider = dependencies.providers[normalizedRequest.operation];
    const expectedEvidenceType = normalizedRequest.operation;
    if (
      !provider ||
      provider.evidenceType !== expectedEvidenceType ||
      !isBoundedText(provider.provider, 80) ||
      typeof provider.verify !== "function"
    ) {
      throw persistenceFailed();
    }
    const now = canonicalDate(dependencies.context.now);
    const requestFingerprint = await sha256CanonicalJson({
      schemaVersion: BUSINESS_EVIDENCE_SCHEMA_VERSION,
      operation: normalizedRequest.operation,
      tenantId: normalizedRequest.tenantId,
      provider: provider.provider,
      normalizedIdentifier:
        normalizedRequest.providerInput.normalizedIdentifier,
      verificationBucket: evidenceBucket(now),
    });
    const query = Object.freeze({
      tenantId: normalizedRequest.tenantId,
      provider: provider.provider,
      requestFingerprint,
    });
    const claim = await dependencies.repository.claim({
      ...query,
      operation: normalizedRequest.operation,
    });
    if (claim?.status === "replay") {
      const replay = await dependencies.repository.findExact(query);
      if (replay === null) throw persistenceFailed();
      return toDisplayDto(
        await normalizeStoredEvidence(replay, {
          request: normalizedRequest,
          provider,
          requestFingerprint,
        }),
        true,
      );
    }
    if (claim?.status === "in_flight") {
      throw requestInFlight(claim.retryAfterSeconds);
    }
    if (claim?.status === "rate_limited") {
      throw rateLimited(claim.retryAfterSeconds);
    }
    if (claim?.status !== "claimed") throw persistenceFailed();

    let normalizedProviderEvidence: BusinessProviderEvidence;
    let providerEvidence: unknown = null;
    try {
      providerEvidence = await provider.verify(
        normalizedRequest.providerInput,
        dependencies.context,
      );
      normalizedProviderEvidence = normalizeProviderEvidence(
        providerEvidence,
        provider,
        normalizedRequest.providerInput.normalizedIdentifier,
      );
    } catch {
      normalizedProviderEvidence = normalizeProviderEvidence(
        unavailableProviderEvidence(
          provider.provider,
          provider.evidenceType,
          normalizedRequest.providerInput.normalizedIdentifier,
          dependencies.context.now,
          sourcePayloadDigestFromUnknown(providerEvidence),
        ),
        provider,
        normalizedRequest.providerInput.normalizedIdentifier,
      );
    }
    const receivedAt = now.toISOString();
    const responseDigest = normalizedProviderEvidence.sourcePayloadSha256;
    const evidenceDigest = await evidenceResponseDigest(
      normalizedProviderEvidence,
    );
    const insertRow: BusinessEvidenceInsert = deepFreeze({
      tenantId: normalizedRequest.tenantId,
      schemaVersion: BUSINESS_EVIDENCE_SCHEMA_VERSION,
      evidenceType: normalizedProviderEvidence.evidenceType,
      normalizedIdentifier: normalizedProviderEvidence.normalizedIdentifier,
      provider: normalizedProviderEvidence.provider,
      resultStatus: normalizedProviderEvidence.resultStatus,
      providerReference: normalizedProviderEvidence.providerReference,
      checkedAt: normalizedProviderEvidence.checkedAt,
      receivedAt,
      requestFingerprint,
      responseDigest,
      evidenceDigest,
      displayFields: normalizedProviderEvidence.displayFields,
    });

    const inserted = await dependencies.repository.insert(insertRow);
    if (inserted?.status === "inserted") {
      if (!isUuid(inserted.id)) throw persistenceFailed();
      return toDisplayDto({ id: inserted.id, ...insertRow }, false);
    }
    if (inserted?.status !== "conflict") throw persistenceFailed();

    const replay = await dependencies.repository.findExact(query);
    if (replay === null) throw persistenceFailed();
    const normalizedReplay = await normalizeStoredEvidence(replay, {
      request: normalizedRequest,
      provider,
      requestFingerprint,
    });
    return toDisplayDto(normalizedReplay, true);
  } catch (error) {
    if (error instanceof BusinessEvidenceError) throw error;
    throw persistenceFailed();
  }
}

export function savedStructuredCvrMatchesRequest(
  settingsInput: unknown,
  requestInput: ParsedBusinessEvidenceRequest,
): boolean {
  try {
    const request = validateParsedRequest(requestInput);
    if (
      request.operation !== "vies" && request.operation !== "danish_company"
    ) {
      return true;
    }
    if (!isPlainRecord(settingsInput)) return false;
    const company = isPlainRecord(settingsInput.company)
      ? settingsInput.company
      : null;
    const identity = company && isPlainRecord(company.business_identity_v1)
      ? company.business_identity_v1
      : null;
    if (identity?.schemaVersion !== BUSINESS_EVIDENCE_SCHEMA_VERSION) {
      return false;
    }
    const normalizedCvr = typeof identity.normalizedCvr === "string"
      ? identity.normalizedCvr
      : "";
    const viesVatId = typeof identity.viesVatId === "string"
      ? identity.viesVatId
      : "";
    return /^\d{8}$/.test(normalizedCvr) &&
      viesVatId === `DK${normalizedCvr}` &&
      request.providerInput.normalizedIdentifier === viesVatId;
  } catch {
    return false;
  }
}

export function unavailableProviderEvidence(
  provider: string,
  evidenceType: BusinessEvidenceType,
  normalizedIdentifier: string,
  now: Date,
  sourcePayloadSha256: string | null = null,
): BusinessProviderEvidence {
  return deepFreeze({
    schemaVersion: BUSINESS_EVIDENCE_SCHEMA_VERSION,
    provider,
    evidenceType,
    normalizedIdentifier,
    resultStatus: "unavailable" as const,
    sourcePayloadSha256,
    providerReference: null,
    checkedAt: canonicalDate(now).toISOString(),
    displayFields: {},
  });
}

export type DatafordelerCredential = Readonly<
  | { kind: "api_key"; value: string }
  | { kind: "bearer"; value: string }
>;

export function normalizeDatafordelerCredential(
  input: DatafordelerCredential | null,
): DatafordelerCredential | null {
  if (!input || (input.kind !== "api_key" && input.kind !== "bearer")) {
    return null;
  }
  const value = typeof input.value === "string" ? input.value.trim() : "";
  if (
    value.length < 16 ||
    value.length > 2_048 ||
    hasControlCharacter(value) ||
    /\s/.test(value)
  ) {
    return null;
  }
  return Object.freeze({ kind: input.kind, value });
}

export type BoundedProviderJson = Readonly<{
  value: unknown;
  sourcePayloadSha256: string;
}>;

export async function fetchBoundedProviderJson(
  options: Readonly<{
    fetchImpl: FetchLike;
    url: string;
    init: RequestInit;
    isAllowedResponseUrl: (url: string) => boolean;
    maximumBytes?: number;
    timeoutMs?: number;
  }>,
): Promise<BoundedProviderJson> {
  try {
    if (typeof options.fetchImpl !== "function") throw providerUnavailable();
    const maximumBytes = options.maximumBytes ??
      BUSINESS_PROVIDER_MAX_BODY_BYTES;
    const timeoutMs = options.timeoutMs ?? BUSINESS_PROVIDER_TIMEOUT_MS;
    if (
      !Number.isSafeInteger(maximumBytes) ||
      maximumBytes < 1 ||
      maximumBytes > BUSINESS_PROVIDER_MAX_BODY_BYTES ||
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 100 ||
      timeoutMs > 10_000
    ) {
      throw providerUnavailable();
    }

    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(providerUnavailable());
      }, timeoutMs);
    });
    const providerPromise = (async () => {
      let upstream: Response;
      try {
        upstream = await options.fetchImpl(options.url, {
          ...options.init,
          signal: controller.signal,
        });
      } catch {
        throw providerUnavailable();
      }
      if (!(upstream instanceof Response)) throw providerUnavailable();
      if (!upstream.ok || (upstream.status >= 300 && upstream.status < 400)) {
        throw providerUnavailable();
      }
      if (upstream.url && !options.isAllowedResponseUrl(upstream.url)) {
        throw providerUnavailable();
      }
      const contentType = upstream.headers.get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (
        contentType !== "application/json" &&
        contentType !== "application/graphql-response+json"
      ) {
        throw providerUnavailable();
      }
      const contentLength = upstream.headers.get("content-length");
      if (contentLength !== null) {
        if (
          !/^\d+$/.test(contentLength) || Number(contentLength) > maximumBytes
        ) {
          throw providerUnavailable();
        }
      }
      const bytes = await readBoundedBody(upstream, maximumBytes);
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw providerUnavailable();
      }
      if (hasDuplicateJsonObjectKeys(text)) throw providerUnavailable();
      let value: unknown;
      try {
        value = JSON.parse(text) as unknown;
      } catch {
        throw providerUnavailable();
      }
      return deepFreeze({
        value,
        sourcePayloadSha256: await sha256ExactBytes(bytes),
      });
    })();
    try {
      return await Promise.race([providerPromise, timeoutPromise]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  } catch {
    throw providerUnavailable();
  }
}

export function canonicalizeBusinessInstant(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !ISO_INSTANT_WITH_ZONE.test(value)
  ) {
    throw providerUnavailable();
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw providerUnavailable();
  return parsed.toISOString();
}

export async function sha256CanonicalJson(value: unknown): Promise<string> {
  let text: string;
  try {
    text = stableJson(value);
  } catch {
    throw persistenceFailed();
  }
  return await sha256ExactBytes(new TextEncoder().encode(text));
}

async function sha256ExactBytes(bytes: Uint8Array): Promise<string> {
  const input = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(input).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function validateParsedRequest(
  request: ParsedBusinessEvidenceRequest,
): ParsedBusinessEvidenceRequest {
  if (!isPlainRecord(request)) throw invalidRequest();
  return parseBusinessEvidenceRequest(
    request.operation === "danish_address" &&
      isPlainRecord(request.providerInput) &&
      request.providerInput.kind === "danish_address"
      ? {
        operation: request.operation,
        tenantId: request.tenantId,
        query: request.providerInput.address,
      }
      : request.operation === "vies" &&
          isPlainRecord(request.providerInput) &&
          request.providerInput.kind === "vies"
      ? {
        operation: request.operation,
        tenantId: request.tenantId,
        cvr: request.providerInput.vatNumber,
      }
      : request.operation === "danish_company" &&
          isPlainRecord(request.providerInput) &&
          request.providerInput.kind === "danish_company"
      ? {
        operation: request.operation,
        tenantId: request.tenantId,
        cvr: request.providerInput.cvr,
      }
      : null,
  );
}

function normalizeProviderEvidence(
  input: unknown,
  provider: BusinessEvidenceProvider,
  normalizedIdentifier: string,
): BusinessProviderEvidence {
  if (!isPlainRecord(input)) throw providerUnavailable();
  if (
    input.schemaVersion !== BUSINESS_EVIDENCE_SCHEMA_VERSION ||
    input.provider !== provider.provider ||
    input.evidenceType !== provider.evidenceType ||
    input.normalizedIdentifier !== normalizedIdentifier ||
    !["valid", "invalid", "unavailable"].includes(String(input.resultStatus))
  ) {
    throw providerUnavailable();
  }
  const resultStatus = input.resultStatus as
    | "valid"
    | "invalid"
    | "unavailable";
  let sourcePayloadSha256: string | null;
  if (input.sourcePayloadSha256 === null) {
    sourcePayloadSha256 = null;
  } else if (
    typeof input.sourcePayloadSha256 === "string" &&
    SHA256_HEX.test(input.sourcePayloadSha256)
  ) {
    sourcePayloadSha256 = input.sourcePayloadSha256;
  } else throw providerUnavailable();
  if (resultStatus !== "unavailable" && sourcePayloadSha256 === null) {
    throw providerUnavailable();
  }
  const providerReference = resultStatus === "unavailable"
    ? null
    : optionalBoundedText(input.providerReference, 256);
  const checkedAt = canonicalizeBusinessInstant(input.checkedAt);
  const displayFields = resultStatus === "unavailable"
    ? Object.freeze({})
    : normalizeDisplayFields(input.displayFields);
  return deepFreeze({
    schemaVersion: BUSINESS_EVIDENCE_SCHEMA_VERSION,
    provider: provider.provider,
    evidenceType: provider.evidenceType,
    normalizedIdentifier,
    resultStatus,
    sourcePayloadSha256,
    providerReference,
    checkedAt,
    displayFields,
  });
}

async function normalizeStoredEvidence(
  input: StoredBusinessEvidence,
  expected: Readonly<{
    request: ParsedBusinessEvidenceRequest;
    provider: BusinessEvidenceProvider;
    requestFingerprint: string;
  }>,
): Promise<StoredBusinessEvidence> {
  try {
    if (!isPlainRecord(input)) throw persistenceFailed();
    const providerEvidence = normalizeProviderEvidence(
      {
        schemaVersion: input.schemaVersion,
        provider: input.provider,
        evidenceType: input.evidenceType,
        normalizedIdentifier: input.normalizedIdentifier,
        resultStatus: input.resultStatus,
        sourcePayloadSha256: input.responseDigest,
        providerReference: input.providerReference,
        checkedAt: input.checkedAt,
        displayFields: input.displayFields,
      },
      expected.provider,
      expected.request.providerInput.normalizedIdentifier,
    );
    const receivedAt = canonicalizeBusinessInstant(input.receivedAt);
    if (
      !isUuid(input.id) ||
      input.tenantId !== expected.request.tenantId ||
      input.requestFingerprint !== expected.requestFingerprint ||
      !SHA256_HEX.test(input.requestFingerprint) ||
      (input.responseDigest !== null &&
        (typeof input.responseDigest !== "string" ||
          !SHA256_HEX.test(input.responseDigest))) ||
      typeof input.evidenceDigest !== "string" ||
      !SHA256_HEX.test(input.evidenceDigest)
    ) {
      throw persistenceFailed();
    }
    const expectedDigest = await evidenceResponseDigest(providerEvidence);
    if (expectedDigest !== input.evidenceDigest) throw persistenceFailed();
    return deepFreeze({
      id: input.id,
      tenantId: expected.request.tenantId,
      schemaVersion: BUSINESS_EVIDENCE_SCHEMA_VERSION,
      evidenceType: providerEvidence.evidenceType,
      normalizedIdentifier: providerEvidence.normalizedIdentifier,
      provider: providerEvidence.provider,
      resultStatus: providerEvidence.resultStatus,
      providerReference: providerEvidence.providerReference,
      checkedAt: providerEvidence.checkedAt,
      receivedAt,
      requestFingerprint: input.requestFingerprint,
      responseDigest: input.responseDigest,
      evidenceDigest: input.evidenceDigest,
      displayFields: providerEvidence.displayFields,
    });
  } catch {
    throw persistenceFailed();
  }
}

function toDisplayDto(
  row: StoredBusinessEvidence,
  replayed: boolean,
): BusinessEvidenceDisplayDto {
  return deepFreeze({
    id: row.id,
    schemaVersion: BUSINESS_EVIDENCE_SCHEMA_VERSION,
    evidenceType: row.evidenceType,
    status: row.resultStatus,
    provider: row.provider,
    providerReference: row.providerReference,
    checkedAt: row.checkedAt,
    displayFields: row.displayFields,
    replayed,
    effect: "display_only" as const,
  });
}

function evidenceResponseDigest(
  input: BusinessProviderEvidence,
): Promise<string> {
  return sha256CanonicalJson({
    schemaVersion: input.schemaVersion,
    evidenceType: input.evidenceType,
    normalizedIdentifier: input.normalizedIdentifier,
    provider: input.provider,
    resultStatus: input.resultStatus,
    sourcePayloadSha256: input.sourcePayloadSha256,
    providerReference: input.providerReference,
    checkedAt: input.checkedAt,
    displayFields: input.displayFields,
  });
}

function sourcePayloadDigestFromUnknown(input: unknown): string | null {
  if (!isPlainRecord(input)) return null;
  return typeof input.sourcePayloadSha256 === "string" &&
      SHA256_HEX.test(input.sourcePayloadSha256)
    ? input.sourcePayloadSha256
    : null;
}

function evidenceBucket(now: Date): string {
  return new Date(
    Math.floor(now.getTime() / EVIDENCE_BUCKET_MS) * EVIDENCE_BUCKET_MS,
  ).toISOString();
}

function normalizeCvr(value: unknown): string {
  if (typeof value !== "string" || value.length > 80) throw invalidRequest();
  const compact = value.trim().replace(/[ -]/g, "");
  if (!/^\d{8}$/.test(compact)) throw invalidRequest();
  return compact;
}

function normalizeDanishAddress(value: unknown): DanishAddressInput {
  if (!isPlainRecord(value)) throw invalidRequest();
  assertExactKeys(value, [
    "streetName",
    "houseNumber",
    "floor",
    "door",
    "postcode",
    "city",
    "country",
  ]);
  const streetName = requiredText(value.streetName, 100);
  const houseNumber = requiredText(value.houseNumber, 12);
  const floor = optionalText(value.floor, 20);
  const door = optionalText(value.door, 20);
  const postcode = requiredText(value.postcode, 4);
  const city = requiredText(value.city, 60);
  const country = typeof value.country === "string"
    ? value.country.trim().toUpperCase()
    : "";
  if (
    country !== "DK" ||
    !/^\d{1,4}[A-Za-z]?$/.test(houseNumber) ||
    !/^\d{4}$/.test(postcode)
  ) {
    throw invalidRequest();
  }
  return deepFreeze({
    streetName,
    houseNumber,
    floor,
    door,
    postcode,
    city,
    country: "DK" as const,
  });
}

function canonicalAddressIdentifierComponent(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase("da-DK");
}

function normalizeDisplayFields(input: unknown): ProviderDisplayFields {
  if (!isPlainRecord(input)) throw providerUnavailable();
  const output: Record<string, string | boolean | null> = {};
  for (const key of Object.keys(input).sort()) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) throw providerUnavailable();
    const value = input[key];
    if (value === null) output[key] = null;
    else if (typeof value === "boolean") output[key] = value;
    else if (
      typeof value === "string" && value.length <= 500 &&
      !hasControlCharacter(value)
    ) {
      output[key] = value;
    } else throw providerUnavailable();
  }
  if (new TextEncoder().encode(JSON.stringify(output)).byteLength > 8_192) {
    throw providerUnavailable();
  }
  return deepFreeze(output);
}

async function readBoundedBody(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) throw providerUnavailable();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) throw providerUnavailable();
      total += result.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw providerUnavailable();
      }
      chunks.push(result.value.slice());
    }
  } catch {
    throw providerUnavailable();
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function stableJson(value: unknown): string {
  if (
    value === null || typeof value === "string" || typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!isPlainRecord(value)) throw persistenceFailed();
  return `{${
    Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    ).join(",")
  }}`;
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: string[],
): void {
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.some((key) => typeof key !== "string") ||
    ownKeys.length !== expected.length ||
    expected.some((key) => !Object.hasOwn(value, key)) ||
    ownKeys.some((key) => !expected.includes(String(key)))
  ) {
    throw invalidRequest();
  }
}

function requiredText(value: unknown, maximum: number): string {
  const text = optionalText(value, maximum);
  if (!text) throw invalidRequest();
  return text;
}

function optionalText(value: unknown, maximum: number): string {
  if (typeof value !== "string") throw invalidRequest();
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length > maximum || hasControlCharacter(text)) {
    throw invalidRequest();
  }
  return text;
}

function optionalBoundedText(value: unknown, maximum: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw providerUnavailable();
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > maximum || hasControlCharacter(text)) {
    throw providerUnavailable();
  }
  return text;
}

function isBoundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= maximum &&
    value === value.trim() &&
    !hasControlCharacter(value);
}

function canonicalDate(value: Date): Date {
  try {
    const milliseconds = Reflect.apply(Date.prototype.getTime, value, []);
    if (!Number.isFinite(milliseconds)) throw providerUnavailable();
    return new Date(milliseconds);
  } catch {
    throw providerUnavailable();
  }
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function isBusinessOperation(
  value: unknown,
): value is BusinessEvidenceOperation {
  return value === "vies" || value === "danish_company" ||
    value === "danish_address";
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasDuplicateJsonObjectKeys(text: string): boolean {
  const stack: Array<
    { kind: "object"; keys: Set<string> } | { kind: "array" }
  > = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      const end = findJsonStringEnd(text, index);
      if (end < 0) return true;
      let cursor = end + 1;
      while (/\s/.test(text[cursor] ?? "")) cursor += 1;
      const container = stack.at(-1);
      if (container?.kind === "object" && text[cursor] === ":") {
        let key: string;
        try {
          key = JSON.parse(text.slice(index, end + 1));
        } catch {
          return true;
        }
        if (container.keys.has(key)) return true;
        container.keys.add(key);
      }
      index = end;
      continue;
    }
    if (character === "{") stack.push({ kind: "object", keys: new Set() });
    else if (character === "[") stack.push({ kind: "array" });
    else if (character === "}" || character === "]") stack.pop();
  }
  return false;
}

function findJsonStringEnd(text: string, start: number): number {
  let escaped = false;
  for (let index = start + 1; index < text.length; index += 1) {
    const character = text[index];
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
    else if (character === '"') return index;
  }
  return -1;
}

function invalidRequest(): BusinessEvidenceError {
  return new BusinessEvidenceError("invalid_request");
}

function providerUnavailable(): BusinessEvidenceError {
  return new BusinessEvidenceError("provider_unavailable");
}

function persistenceFailed(): BusinessEvidenceError {
  return new BusinessEvidenceError("persistence_failed");
}

function rateLimited(retryAfterSeconds: number): BusinessEvidenceError {
  return new BusinessEvidenceError("rate_limited", retryAfterSeconds);
}

function requestInFlight(retryAfterSeconds: number): BusinessEvidenceError {
  return new BusinessEvidenceError("request_in_flight", retryAfterSeconds);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child, seen);
  }
  return Object.freeze(value);
}
