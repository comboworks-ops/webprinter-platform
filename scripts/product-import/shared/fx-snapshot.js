import { createHash } from "node:crypto";

const SNAPSHOT_SCHEMA_VERSION = 1;
const SNAPSHOT_PROVIDER = "frankfurter_ecb";
const BASE_CURRENCY = "EUR";
const QUOTE_CURRENCY = "DKK";
const MAX_EUR_DKK_RATE = 100;
const MAX_RAW_BODY_BYTES = 16 * 1024;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function parseFrankfurterEurDkkSnapshot(rawBody, fetchedAt) {
  const rawBytes = toRawBytes(rawBody);
  const sourcePayloadSha256 = createHash("sha256").update(rawBytes).digest("hex");

  let payload;
  try {
    const rawText = new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);
    if (hasDuplicateTopLevelKeys(rawText)) throw invalidFrankfurterResponse();
    payload = JSON.parse(rawText);
  } catch {
    throw invalidFrankfurterResponse();
  }

  if (
    !isRecord(payload) ||
    !Object.hasOwn(payload, "date") ||
    !Object.hasOwn(payload, "base") ||
    !Object.hasOwn(payload, "quote") ||
    !Object.hasOwn(payload, "rate") ||
    Object.hasOwn(payload, "amount") ||
    Object.hasOwn(payload, "rates") ||
    payload.base !== BASE_CURRENCY ||
    payload.quote !== QUOTE_CURRENCY ||
    !isRealIsoDate(payload.date) ||
    !isBoundedEurDkkRate(payload.rate)
  ) {
    throw invalidFrankfurterResponse();
  }

  return parseFxSnapshot({
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    provider: SNAPSHOT_PROVIDER,
    baseCurrency: BASE_CURRENCY,
    quoteCurrency: QUOTE_CURRENCY,
    rate: payload.rate,
    rateDate: payload.date,
    fetchedAt,
    sourcePayloadSha256,
  });
}

export function parseFxSnapshot(input) {
  try {
    if (
      !isRecord(input) ||
      input.schemaVersion !== SNAPSHOT_SCHEMA_VERSION ||
      input.provider !== SNAPSHOT_PROVIDER ||
      input.baseCurrency !== BASE_CURRENCY ||
      input.quoteCurrency !== QUOTE_CURRENCY ||
      !isBoundedEurDkkRate(input.rate) ||
      !isRealIsoDate(input.rateDate) ||
      !isCanonicalIsoInstant(input.fetchedAt) ||
      typeof input.sourcePayloadSha256 !== "string" ||
      !SHA256_HEX.test(input.sourcePayloadSha256)
    ) {
      throw invalidFxSnapshot();
    }

    return deepFreeze({
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      provider: SNAPSHOT_PROVIDER,
      baseCurrency: BASE_CURRENCY,
      quoteCurrency: QUOTE_CURRENCY,
      rate: input.rate,
      rateDate: input.rateDate,
      fetchedAt: input.fetchedAt,
      sourcePayloadSha256: input.sourcePayloadSha256,
    });
  } catch {
    throw invalidFxSnapshot();
  }
}

export function canonicalizeFxSnapshot(snapshot) {
  return JSON.stringify(parseFxSnapshot(snapshot));
}

function toRawBytes(rawBody) {
  if (rawBody instanceof Uint8Array) {
    if (rawBody.byteLength > MAX_RAW_BODY_BYTES) throw invalidFrankfurterResponse();
    return Uint8Array.from(rawBody);
  }
  if (rawBody instanceof ArrayBuffer) {
    if (rawBody.byteLength > MAX_RAW_BODY_BYTES) throw invalidFrankfurterResponse();
    return new Uint8Array(rawBody).slice();
  }
  throw invalidFrankfurterResponse();
}

function hasDuplicateTopLevelKeys(rawText) {
  const keys = new Set();
  let nesting = 0;

  for (let index = 0; index < rawText.length; index += 1) {
    const character = rawText[index];
    if (character === '"') {
      const end = findJsonStringEnd(rawText, index);
      if (end === -1) return true;
      let cursor = end + 1;
      while (/\s/.test(rawText[cursor] ?? "")) cursor += 1;
      if (nesting === 1 && rawText[cursor] === ":") {
        let key;
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

function findJsonStringEnd(rawText, start) {
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

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBoundedEurDkkRate(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_EUR_DKK_RATE
  );
}

function isRealIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) && parsed.toISOString() === `${value}T00:00:00.000Z`
  );
}

function isCanonicalIsoInstant(value) {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

function invalidFrankfurterResponse() {
  return new TypeError("Invalid Frankfurter EUR/DKK response");
}

function invalidFxSnapshot() {
  return new TypeError("Invalid FX snapshot contract");
}
