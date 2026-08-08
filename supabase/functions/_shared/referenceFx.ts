export const FRANKFURTER_ECB_URL =
  "https://api.frankfurter.dev/v2/rate/EUR/DKK?providers=ECB";
export const FRANKFURTER_TIMEOUT_MS = 5_000;
export const FRANKFURTER_MAX_BODY_BYTES = 16 * 1024;
export const FRANKFURTER_MAX_RATE_AGE_DAYS = 7;

const PROVIDER = "frankfurter_ecb" as const;
const BASE_CURRENCY = "EUR" as const;
const QUOTE_CURRENCY = "DKK" as const;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const STORED_UTC_INSTANT =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/;
const RATE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;

export type ReferenceFxErrorCode =
  | "invalid_request"
  | "provider_unavailable"
  | "invalid_provider_response"
  | "stale_rate"
  | "rate_date_mismatch"
  | "persistence_failed";

const ERROR_MESSAGES: Record<ReferenceFxErrorCode, string> = {
  invalid_request: "Invalid reference exchange-rate request",
  provider_unavailable: "Reference exchange-rate provider is unavailable",
  invalid_provider_response: "Invalid reference exchange-rate response",
  stale_rate: "Reference exchange rate is stale",
  rate_date_mismatch: "Reference exchange-rate date did not match",
  persistence_failed: "Reference exchange-rate evidence could not be stored",
};

export class ReferenceFxError extends Error {
  readonly code: ReferenceFxErrorCode;

  constructor(code: ReferenceFxErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "ReferenceFxError";
    this.code = code;
  }
}

export type ReferenceFxSnapshot = Readonly<{
  schemaVersion: 1;
  provider: typeof PROVIDER;
  baseCurrency: typeof BASE_CURRENCY;
  quoteCurrency: typeof QUOTE_CURRENCY;
  rate: number;
  rateDate: string;
  fetchedAt: string;
  sourcePayloadSha256: string;
}>;

export type ReferenceFxRequest = Readonly<{
  baseCurrency: typeof BASE_CURRENCY;
  quoteCurrency: typeof QUOTE_CURRENCY;
  expectedRateDate?: string;
}>;

export type FxSnapshotRow = Readonly<{
  id: string;
  snapshot: ReferenceFxSnapshot;
}>;

export type FxSnapshotInsertResult =
  | Readonly<{ status: "inserted"; row: FxSnapshotRow }>
  | Readonly<{ status: "conflict" }>;

export type FxSnapshotRepository = Readonly<{
  findExact: (snapshot: ReferenceFxSnapshot) => Promise<FxSnapshotRow | null>;
  insert: (snapshot: ReferenceFxSnapshot) => Promise<FxSnapshotInsertResult>;
}>;

export type PersistedReferenceFxSnapshot = Readonly<{
  id: string;
  replayed: boolean;
  snapshot: ReferenceFxSnapshot;
}>;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export function isAllowedFrankfurterEcbUrl(value: unknown): boolean {
  return typeof value === "string" && value === FRANKFURTER_ECB_URL;
}

export function buildFrankfurterEcbRequest(): Readonly<{
  url: typeof FRANKFURTER_ECB_URL;
  init: Readonly<RequestInit>;
}> {
  return Object.freeze({
    url: FRANKFURTER_ECB_URL,
    init: Object.freeze({
      method: "GET",
      redirect: "manual",
      headers: Object.freeze({ Accept: "application/json" }),
    }),
  });
}

export async function fetchFrankfurterEurDkkSnapshot(
  options: Readonly<{
    fetchImpl: FetchLike;
    now: Date;
  }>,
): Promise<ReferenceFxSnapshot> {
  try {
    const fetchImpl = options.fetchImpl;
    const fetchedAt = canonicalInstant(options.now);
    if (typeof fetchImpl !== "function") throw providerUnavailable();

    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(providerUnavailable());
      }, FRANKFURTER_TIMEOUT_MS);
    });

    const request = buildFrankfurterEcbRequest();
    const providerPromise = (async () => {
      let response: Response;
      try {
        response = await fetchImpl(request.url, {
          ...request.init,
          signal: controller.signal,
        });
      } catch {
        throw providerUnavailable();
      }

      if (!(response instanceof Response)) throw providerUnavailable();
      if (!response.ok || (response.status >= 300 && response.status < 400)) {
        throw providerUnavailable();
      }
      if (response.url && !isAllowedFrankfurterEcbUrl(response.url)) {
        throw providerUnavailable();
      }

      const mediaType = response.headers.get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (mediaType !== "application/json") throw invalidProviderResponse();

      const contentLength = response.headers.get("content-length");
      if (contentLength !== null) {
        if (!/^\d+$/.test(contentLength)) throw invalidProviderResponse();
        if (Number(contentLength) > FRANKFURTER_MAX_BODY_BYTES) {
          throw invalidProviderResponse();
        }
      }

      const rawBody = await readBoundedBody(
        response,
        FRANKFURTER_MAX_BODY_BYTES,
      );
      const sourcePayloadSha256 = await sha256Hex(rawBody);
      return parseProviderBytes(rawBody, fetchedAt, sourcePayloadSha256);
    })();

    try {
      return await Promise.race([providerPromise, timeoutPromise]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  } catch (error) {
    if (error instanceof ReferenceFxError) throw error;
    throw providerUnavailable();
  }
}

export function parseReferenceFxRequest(input: unknown): ReferenceFxRequest {
  try {
    if (!isPlainRecord(input)) throw invalidRequest();
    const keys = Reflect.ownKeys(input);
    if (keys.some((key) => typeof key !== "string")) throw invalidRequest();
    const expectedKeys = new Set([
      "baseCurrency",
      "quoteCurrency",
      "expectedRateDate",
    ]);
    if (keys.some((key) => !expectedKeys.has(String(key)))) {
      throw invalidRequest();
    }
    if (
      !Object.hasOwn(input, "baseCurrency") ||
      !Object.hasOwn(input, "quoteCurrency")
    ) {
      throw invalidRequest();
    }

    const baseCurrency = input.baseCurrency;
    const quoteCurrency = input.quoteCurrency;
    const hasExpectedRateDate = Object.hasOwn(input, "expectedRateDate");
    const expectedRateDate = input.expectedRateDate;
    if (
      baseCurrency !== BASE_CURRENCY ||
      quoteCurrency !== QUOTE_CURRENCY ||
      (hasExpectedRateDate && !isRealIsoDate(expectedRateDate))
    ) {
      throw invalidRequest();
    }

    return Object.freeze({
      baseCurrency,
      quoteCurrency,
      ...(hasExpectedRateDate
        ? { expectedRateDate: expectedRateDate as string }
        : {}),
    });
  } catch {
    throw invalidRequest();
  }
}

export function assertExpectedRateDate(
  snapshot: ReferenceFxSnapshot,
  expectedRateDate?: string,
): void {
  if (expectedRateDate === undefined) return;
  if (
    !isRealIsoDate(expectedRateDate) || snapshot.rateDate !== expectedRateDate
  ) {
    throw new ReferenceFxError("rate_date_mismatch");
  }
}

export async function persistReferenceFxSnapshot(
  candidate: ReferenceFxSnapshot,
  repository: FxSnapshotRepository,
): Promise<PersistedReferenceFxSnapshot> {
  try {
    const snapshot = normalizeSnapshot(candidate);
    const findExact = repository.findExact;
    const insert = repository.insert;
    if (typeof findExact !== "function" || typeof insert !== "function") {
      throw persistenceFailed();
    }

    const existing = await Reflect.apply(findExact, repository, [snapshot]);
    if (existing !== null) {
      return persistedResult(existing, true, snapshot);
    }

    const inserted = await Reflect.apply(insert, repository, [snapshot]);
    if (inserted?.status === "inserted") {
      return persistedResult(inserted.row, false, snapshot);
    }
    if (inserted?.status !== "conflict") throw persistenceFailed();

    const replay = await Reflect.apply(findExact, repository, [snapshot]);
    if (replay === null) throw persistenceFailed();
    return persistedResult(replay, true, snapshot);
  } catch (error) {
    if (
      error instanceof ReferenceFxError && error.code === "persistence_failed"
    ) {
      throw error;
    }
    throw persistenceFailed();
  }
}

export function toPublicReferenceFxSnapshot(
  persisted: PersistedReferenceFxSnapshot,
): PersistedReferenceFxSnapshot {
  try {
    if (!isPlainRecord(persisted)) throw persistenceFailed();
    const id = persisted.id;
    const replayed = persisted.replayed;
    const snapshot = normalizeSnapshot(persisted.snapshot);
    if (!isUuid(id) || typeof replayed !== "boolean") throw persistenceFailed();

    return deepFreeze({
      id,
      replayed,
      snapshot: {
        schemaVersion: snapshot.schemaVersion,
        provider: snapshot.provider,
        baseCurrency: snapshot.baseCurrency,
        quoteCurrency: snapshot.quoteCurrency,
        rate: snapshot.rate,
        rateDate: snapshot.rateDate,
        fetchedAt: snapshot.fetchedAt,
        sourcePayloadSha256: snapshot.sourcePayloadSha256,
      },
    });
  } catch {
    throw persistenceFailed();
  }
}

async function readBoundedBody(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) throw invalidProviderResponse();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) {
        throw invalidProviderResponse();
      }
      totalBytes += result.value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw invalidProviderResponse();
      }
      chunks.push(result.value.slice());
    }
  } catch (error) {
    if (error instanceof ReferenceFxError) throw error;
    throw invalidProviderResponse();
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digestInput = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(digestInput).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", digestInput);
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function parseProviderBytes(
  rawBody: Uint8Array,
  fetchedAt: string,
  sourcePayloadSha256: string,
): ReferenceFxSnapshot {
  let payload: unknown;
  try {
    const rawText = new TextDecoder("utf-8", { fatal: true }).decode(rawBody);
    if (hasDuplicateTopLevelKeys(rawText)) throw invalidProviderResponse();
    payload = JSON.parse(rawText);
  } catch {
    throw invalidProviderResponse();
  }

  if (!isPlainRecord(payload)) throw invalidProviderResponse();
  const date = payload.date;
  const base = payload.base;
  const quote = payload.quote;
  const rate = payload.rate;
  if (
    !Object.hasOwn(payload, "date") ||
    !Object.hasOwn(payload, "base") ||
    !Object.hasOwn(payload, "quote") ||
    !Object.hasOwn(payload, "rate") ||
    Object.hasOwn(payload, "amount") ||
    Object.hasOwn(payload, "rates") ||
    base !== BASE_CURRENCY ||
    quote !== QUOTE_CURRENCY ||
    !isRealIsoDate(date) ||
    !isBoundedRate(rate)
  ) {
    throw invalidProviderResponse();
  }

  const ageDays = utcCalendarDay(date as string, fetchedAt.slice(0, 10));
  if (ageDays < 0) throw invalidProviderResponse();
  if (ageDays > FRANKFURTER_MAX_RATE_AGE_DAYS) {
    throw new ReferenceFxError("stale_rate");
  }

  return deepFreeze({
    schemaVersion: 1,
    provider: PROVIDER,
    baseCurrency: BASE_CURRENCY,
    quoteCurrency: QUOTE_CURRENCY,
    rate: rate as number,
    rateDate: date as string,
    fetchedAt,
    sourcePayloadSha256,
  });
}

function normalizeSnapshot(input: unknown): ReferenceFxSnapshot {
  if (!isPlainRecord(input)) throw persistenceFailed();
  const schemaVersion = input.schemaVersion;
  const provider = input.provider;
  const baseCurrency = input.baseCurrency;
  const quoteCurrency = input.quoteCurrency;
  const rate = input.rate;
  const rateDate = input.rateDate;
  const fetchedAt = input.fetchedAt;
  const sourcePayloadSha256 = input.sourcePayloadSha256;
  const ageDays = isRealIsoDate(rateDate) && isCanonicalInstant(fetchedAt)
    ? utcCalendarDay(rateDate, fetchedAt.slice(0, 10))
    : Number.NaN;

  if (
    schemaVersion !== 1 ||
    provider !== PROVIDER ||
    baseCurrency !== BASE_CURRENCY ||
    quoteCurrency !== QUOTE_CURRENCY ||
    !isBoundedRate(rate) ||
    !isRealIsoDate(rateDate) ||
    !isCanonicalInstant(fetchedAt) ||
    ageDays < 0 ||
    ageDays > FRANKFURTER_MAX_RATE_AGE_DAYS ||
    typeof sourcePayloadSha256 !== "string" ||
    !SHA256_HEX.test(sourcePayloadSha256)
  ) {
    throw persistenceFailed();
  }

  return deepFreeze({
    schemaVersion,
    provider,
    baseCurrency,
    quoteCurrency,
    rate: rate as number,
    rateDate: rateDate as string,
    fetchedAt: fetchedAt as string,
    sourcePayloadSha256,
  });
}

function persistedResult(
  row: FxSnapshotRow,
  replayed: boolean,
  candidate: ReferenceFxSnapshot,
): PersistedReferenceFxSnapshot {
  if (!isPlainRecord(row) || !isUuid(row.id)) throw persistenceFailed();
  const snapshot = normalizeStoredSnapshot(row.snapshot);
  if (
    snapshot.schemaVersion !== candidate.schemaVersion ||
    snapshot.provider !== candidate.provider ||
    snapshot.baseCurrency !== candidate.baseCurrency ||
    snapshot.quoteCurrency !== candidate.quoteCurrency ||
    snapshot.rate !== candidate.rate ||
    snapshot.rateDate !== candidate.rateDate ||
    snapshot.sourcePayloadSha256 !== candidate.sourcePayloadSha256
  ) {
    throw persistenceFailed();
  }
  return deepFreeze({ id: row.id, replayed, snapshot });
}

/**
 * PostgREST serializes PostgreSQL timestamptz values with a UTC offset and may
 * retain up to six fractional digits. Accept that database representation only
 * when conversion to the public millisecond contract is exact. Candidate and
 * public payloads continue to require the canonical `.sssZ` representation.
 */
function normalizeStoredSnapshot(input: unknown): ReferenceFxSnapshot {
  if (!isPlainRecord(input)) throw persistenceFailed();
  const fetchedAt = canonicalizeStoredInstant(input.fetchedAt);
  return normalizeSnapshot({ ...input, fetchedAt });
}

function canonicalizeStoredInstant(value: unknown): string {
  if (typeof value !== "string") throw persistenceFailed();
  const match = STORED_UTC_INSTANT.exec(value);
  if (!match) throw persistenceFailed();

  const fractional = match[2] ?? "";
  const microseconds = fractional.padEnd(6, "0");
  if (microseconds.slice(3) !== "000") throw persistenceFailed();

  const canonical = `${match[1]}.${microseconds.slice(0, 3)}Z`;
  if (!isCanonicalInstant(canonical)) throw persistenceFailed();
  return canonical;
}

function canonicalInstant(value: Date): string {
  try {
    const timestamp = Reflect.apply(Date.prototype.getTime, value, []);
    if (!Number.isFinite(timestamp)) throw providerUnavailable();
    return Reflect.apply(Date.prototype.toISOString, value, []);
  } catch {
    throw providerUnavailable();
  }
}

function isCanonicalInstant(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function isRealIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString() === `${value}T00:00:00.000Z`;
}

function utcCalendarDay(rateDate: string, fetchedDate: string): number {
  return Math.floor(
    (Date.parse(`${fetchedDate}T00:00:00.000Z`) -
      Date.parse(`${rateDate}T00:00:00.000Z`)) /
      86_400_000,
  );
}

function isBoundedRate(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    RATE_DECIMAL.test(String(value)) &&
    value > 0 &&
    value <= 100;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function hasDuplicateTopLevelKeys(rawText: string): boolean {
  const keys = new Set<string>();
  let nesting = 0;

  for (let index = 0; index < rawText.length; index += 1) {
    const character = rawText[index];
    if (character === '"') {
      const end = findJsonStringEnd(rawText, index);
      if (end === -1) return true;
      let cursor = end + 1;
      while (/\s/.test(rawText[cursor] ?? "")) cursor += 1;
      if (nesting === 1 && rawText[cursor] === ":") {
        let key: string;
        try {
          key = JSON.parse(rawText.slice(index, end + 1));
        } catch {
          return true;
        }
        if (keys.has(key)) return true;
        keys.add(key);
      }
      index = end;
      continue;
    }
    if (character === "{" || character === "[") nesting += 1;
    else if (character === "}" || character === "]") nesting -= 1;
  }

  return false;
}

function findJsonStringEnd(rawText: string, start: number): number {
  let escaped = false;
  for (let index = start + 1; index < rawText.length; index += 1) {
    const character = rawText[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") escaped = true;
    else if (character === '"') return index;
  }
  return -1;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

function invalidRequest(): ReferenceFxError {
  return new ReferenceFxError("invalid_request");
}

function providerUnavailable(): ReferenceFxError {
  return new ReferenceFxError("provider_unavailable");
}

function invalidProviderResponse(): ReferenceFxError {
  return new ReferenceFxError("invalid_provider_response");
}

function persistenceFailed(): ReferenceFxError {
  return new ReferenceFxError("persistence_failed");
}
