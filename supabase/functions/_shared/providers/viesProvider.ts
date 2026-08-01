import {
  BUSINESS_EVIDENCE_SCHEMA_VERSION,
  type BusinessEvidenceProvider,
  type BusinessProviderEvidence,
  canonicalizeBusinessInstant,
  fetchBoundedProviderJson,
  type ProviderContext,
  unavailableProviderEvidence,
  type ViesProviderInput,
} from "../businessEvidence.ts";

export const VIES_CHECK_URL =
  "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number";
export const VIES_PROVIDER = "EU VIES";

export function createViesProvider(): BusinessEvidenceProvider {
  return Object.freeze({
    provider: VIES_PROVIDER,
    evidenceType: "vies" as const,
    verify: async (input, context) => {
      if (!isViesInput(input)) {
        return unavailable(input, context);
      }
      let sourcePayloadSha256: string | null = null;
      try {
        const fetched = await fetchBoundedProviderJson({
          fetchImpl: context.fetchImpl,
          url: VIES_CHECK_URL,
          init: {
            method: "POST",
            redirect: "manual",
            headers: Object.freeze({
              Accept: "application/json",
              "Content-Type": "application/json",
            }),
            body: JSON.stringify({
              countryCode: input.countryCode,
              vatNumber: input.vatNumber,
            }),
          },
          isAllowedResponseUrl: (url) => url === VIES_CHECK_URL,
        });
        sourcePayloadSha256 = fetched.sourcePayloadSha256;
        return parseViesResponse(
          fetched.value,
          input,
          sourcePayloadSha256,
        );
      } catch {
        return unavailable(input, context, sourcePayloadSha256);
      }
    },
  });
}

function parseViesResponse(
  payload: unknown,
  input: ViesProviderInput,
  sourcePayloadSha256: string,
): BusinessProviderEvidence {
  if (!isPlainRecord(payload)) throw new Error("invalid provider response");
  const countryCode = payload.countryCode;
  const vatNumber = normalizeReturnedVatNumber(payload.vatNumber);
  const valid = payload.valid;
  if (
    countryCode !== input.countryCode ||
    vatNumber !== input.vatNumber ||
    typeof valid !== "boolean"
  ) {
    throw new Error("invalid provider response");
  }
  const checkedAt = canonicalizeBusinessInstant(payload.requestDate);
  const providerReference = optionalProviderText(
    payload.requestIdentifier,
    256,
  );
  const registeredName = optionalDisplayText(payload.name, 300);
  const registeredAddress = optionalDisplayText(payload.address, 500);
  return deepFreeze({
    schemaVersion: BUSINESS_EVIDENCE_SCHEMA_VERSION,
    provider: VIES_PROVIDER,
    evidenceType: "vies" as const,
    normalizedIdentifier: input.normalizedIdentifier,
    resultStatus: valid ? "valid" as const : "invalid" as const,
    sourcePayloadSha256,
    providerReference,
    checkedAt,
    displayFields: {
      vatId: input.normalizedIdentifier,
      registeredName,
      registeredAddress,
    },
  });
}

function unavailable(
  input: { normalizedIdentifier?: unknown },
  context: ProviderContext,
  sourcePayloadSha256: string | null = null,
): BusinessProviderEvidence {
  const normalizedIdentifier =
    typeof input?.normalizedIdentifier === "string" &&
      /^DK\d{8}$/.test(input.normalizedIdentifier)
      ? input.normalizedIdentifier
      : "DK00000000";
  return unavailableProviderEvidence(
    VIES_PROVIDER,
    "vies",
    normalizedIdentifier,
    context.now,
    sourcePayloadSha256,
  );
}

function isViesInput(input: unknown): input is ViesProviderInput {
  return isPlainRecord(input) &&
    input.kind === "vies" &&
    input.countryCode === "DK" &&
    typeof input.vatNumber === "string" &&
    /^\d{8}$/.test(input.vatNumber) &&
    input.normalizedIdentifier === `DK${input.vatNumber}`;
}

function normalizeReturnedVatNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.replace(/[ -]/g, "").toUpperCase();
  return compact.startsWith("DK") ? compact.slice(2) : compact;
}

function optionalProviderText(value: unknown, maximum: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("invalid provider response");
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > maximum || hasControlCharacter(text)) {
    throw new Error("invalid provider response");
  }
  return text;
}

function optionalDisplayText(value: unknown, maximum: number): string | null {
  const text = optionalProviderText(value, maximum);
  return text === "---" ? null : text;
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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
