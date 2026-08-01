import {
  BUSINESS_EVIDENCE_SCHEMA_VERSION,
  type BusinessEvidenceProvider,
  type BusinessProviderEvidence,
  type DanishAddressProviderInput,
  type DatafordelerCredential,
  fetchBoundedProviderJson,
  normalizeDatafordelerCredential,
  type ProviderContext,
  unavailableProviderEvidence,
} from "../businessEvidence.ts";

export const DATAFORDELER_DAR_URL = "https://graphql.datafordeler.dk/DAR/v3";
export const DATAFORDELER_DAR_PROVIDER = "Datafordeler DAR";

export function createDanishAddressProvider(
  credentialInput: DatafordelerCredential | null,
): BusinessEvidenceProvider {
  const credential = normalizeDatafordelerCredential(credentialInput);
  return Object.freeze({
    provider: DATAFORDELER_DAR_PROVIDER,
    evidenceType: "danish_address" as const,
    verify: async (input, context) => {
      if (!isAddressInput(input) || credential === null) {
        return unavailable(input, context);
      }
      try {
        const request = buildRequest(input, context, credential);
        const payload = await fetchBoundedProviderJson({
          fetchImpl: context.fetchImpl,
          url: request.url,
          init: request.init,
          isAllowedResponseUrl: (url) =>
            isExactDatafordelerUrl(url, request.url),
        });
        return parseAddressResponse(payload, input, context);
      } catch {
        return unavailable(input, context);
      }
    },
  });
}

function buildRequest(
  input: DanishAddressProviderInput,
  context: ProviderContext,
  credential: DatafordelerCredential,
): Readonly<{ url: string; init: RequestInit }> {
  const instant = context.now.toISOString();
  const officialAddress = formatOfficialAddress(input);
  const query = `query ExactAddress {
  DAR_Adresse(
    first: 2
    registreringstid: ${JSON.stringify(instant)}
    virkningstid: ${JSON.stringify(instant)}
    where: {
      adressebetegnelse: { eq: ${JSON.stringify(officialAddress)} }
      status: { in: ["2", "3"] }
    }
  ) {
    nodes {
      id_lokalId
      adressebetegnelse
      etagebetegnelse
      doerbetegnelse
      status
    }
  }
}`;
  const url = new URL(DATAFORDELER_DAR_URL);
  const headers = new Headers({
    Accept: "application/graphql-response+json",
    "Content-Type": "application/json",
  });
  if (credential.kind === "api_key") {
    url.searchParams.set("apiKey", credential.value);
  } else headers.set("Authorization", `Bearer ${credential.value}`);
  return Object.freeze({
    url: url.toString(),
    init: Object.freeze({
      method: "POST",
      redirect: "manual",
      headers,
      body: JSON.stringify({ query }),
    }),
  });
}

function parseAddressResponse(
  payload: unknown,
  input: DanishAddressProviderInput,
  context: ProviderContext,
): BusinessProviderEvidence {
  if (!isPlainRecord(payload) || hasGraphQlErrors(payload.errors)) {
    throw new Error("invalid provider response");
  }
  const data = isPlainRecord(payload.data) ? payload.data : null;
  const connection = data && isPlainRecord(data.DAR_Adresse)
    ? data.DAR_Adresse
    : null;
  const nodes = connection?.nodes;
  if (!Array.isArray(nodes) || nodes.length > 1) {
    throw new Error("invalid provider response");
  }
  if (nodes.length === 0) {
    return evidence(input, context, "invalid", null, null, null);
  }
  const node = nodes[0];
  if (!isPlainRecord(node)) throw new Error("invalid provider response");
  const officialAddress = requiredText(node.adressebetegnelse, 500);
  if (
    normalizeWhitespace(officialAddress) !==
      normalizeWhitespace(formatOfficialAddress(input))
  ) {
    throw new Error("invalid provider response");
  }
  const status = requiredText(node.status, 20);
  if (status !== "2" && status !== "3") {
    throw new Error("invalid provider response");
  }
  const reference = requiredUuid(node.id_lokalId);
  return evidence(input, context, "valid", reference, officialAddress, status);
}

function evidence(
  input: DanishAddressProviderInput,
  context: ProviderContext,
  resultStatus: "valid" | "invalid",
  providerReference: string | null,
  officialAddress: string | null,
  officialStatus: string | null,
): BusinessProviderEvidence {
  return deepFreeze({
    schemaVersion: BUSINESS_EVIDENCE_SCHEMA_VERSION,
    provider: DATAFORDELER_DAR_PROVIDER,
    evidenceType: "danish_address" as const,
    normalizedIdentifier: input.normalizedIdentifier,
    resultStatus,
    providerReference,
    checkedAt: context.now.toISOString(),
    displayFields: {
      streetName: input.address.streetName,
      houseNumber: input.address.houseNumber,
      floor: input.address.floor,
      door: input.address.door,
      postcode: input.address.postcode,
      city: input.address.city,
      country: input.address.country,
      officialAddress,
      officialStatus,
    },
  });
}

function formatOfficialAddress(input: DanishAddressProviderInput): string {
  const unit = [input.address.floor, input.address.door].filter(Boolean).join(
    " ",
  );
  return `${input.address.streetName} ${input.address.houseNumber}, ${
    unit ? `${unit}, ` : ""
  }${input.address.postcode} ${input.address.city}`;
}

function unavailable(
  input: { normalizedIdentifier?: unknown },
  context: ProviderContext,
): BusinessProviderEvidence {
  const identifier = typeof input?.normalizedIdentifier === "string" &&
      input.normalizedIdentifier.length >= 1 &&
      input.normalizedIdentifier.length <= 256
    ? input.normalizedIdentifier
    : "DK|0000|unavailable";
  return unavailableProviderEvidence(
    DATAFORDELER_DAR_PROVIDER,
    "danish_address",
    identifier,
    context.now,
  );
}

function isAddressInput(input: unknown): input is DanishAddressProviderInput {
  if (!isPlainRecord(input) || input.kind !== "danish_address") return false;
  if (
    typeof input.normalizedIdentifier !== "string" ||
    input.normalizedIdentifier.length < 1 ||
    input.normalizedIdentifier.length > 256 ||
    !isPlainRecord(input.address)
  ) return false;
  const address = input.address;
  return typeof address.streetName === "string" &&
    address.streetName.length >= 1 &&
    typeof address.houseNumber === "string" &&
    /^\d{1,4}[A-Za-z]?$/.test(address.houseNumber) &&
    typeof address.floor === "string" && address.floor.length <= 20 &&
    typeof address.door === "string" && address.door.length <= 20 &&
    typeof address.postcode === "string" && /^\d{4}$/.test(address.postcode) &&
    typeof address.city === "string" && address.city.length >= 1 &&
    address.country === "DK";
}

function requiredUuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
  ) throw new Error("invalid provider response");
  return value;
}

function requiredText(value: unknown, maximum: number): string {
  if (typeof value !== "string") throw new Error("invalid provider response");
  const text = normalizeWhitespace(value);
  if (!text || text.length > maximum || hasControlCharacter(text)) {
    throw new Error("invalid provider response");
  }
  return text;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasGraphQlErrors(value: unknown): boolean {
  return value !== undefined && (!Array.isArray(value) || value.length > 0);
}

function isExactDatafordelerUrl(candidate: string, expected: string): boolean {
  try {
    return new URL(candidate).toString() === new URL(expected).toString();
  } catch {
    return false;
  }
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
