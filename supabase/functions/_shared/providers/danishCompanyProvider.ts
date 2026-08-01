import {
  BUSINESS_EVIDENCE_SCHEMA_VERSION,
  type BusinessEvidenceProvider,
  type BusinessProviderEvidence,
  type DanishCompanyProviderInput,
  type DatafordelerCredential,
  fetchBoundedProviderJson,
  normalizeDatafordelerCredential,
  type ProviderContext,
  unavailableProviderEvidence,
} from "../businessEvidence.ts";

export const DATAFORDELER_CVR_URL = "https://graphql.datafordeler.dk/CVR/v2";
export const DATAFORDELER_CVR_PROVIDER = "Datafordeler CVR";

export function createDanishCompanyProvider(
  credentialInput: DatafordelerCredential | null,
): BusinessEvidenceProvider {
  const credential = normalizeDatafordelerCredential(credentialInput);
  return Object.freeze({
    provider: DATAFORDELER_CVR_PROVIDER,
    evidenceType: "danish_company" as const,
    verify: async (input, context) => {
      if (!isCompanyInput(input) || credential === null) {
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
        return parseCompanyResponse(payload, input, context);
      } catch {
        return unavailable(input, context);
      }
    },
  });
}

function buildRequest(
  input: DanishCompanyProviderInput,
  context: ProviderContext,
  credential: DatafordelerCredential,
): Readonly<{ url: string; init: RequestInit }> {
  const instant = context.now.toISOString();
  const query = `query CurrentCompany {
  CVR_Virksomhed(
    first: 2
    registreringstid: ${JSON.stringify(instant)}
    virkningstid: ${JSON.stringify(instant)}
    where: { CVRNummer: { eq: ${JSON.stringify(input.cvr)} } }
  ) {
    nodes {
      id
      CVRNummer
      status
      virksomhedStartdato
      virksomhedOphoersdato
    }
  }
}`;
  const url = new URL(DATAFORDELER_CVR_URL);
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

function parseCompanyResponse(
  payload: unknown,
  input: DanishCompanyProviderInput,
  context: ProviderContext,
): BusinessProviderEvidence {
  if (!isPlainRecord(payload) || hasGraphQlErrors(payload.errors)) {
    throw new Error("invalid provider response");
  }
  const data = isPlainRecord(payload.data) ? payload.data : null;
  const connection = data && isPlainRecord(data.CVR_Virksomhed)
    ? data.CVR_Virksomhed
    : null;
  const nodes = connection?.nodes;
  if (!Array.isArray(nodes) || nodes.length > 1) {
    throw new Error("invalid provider response");
  }
  if (nodes.length === 0) {
    return evidence(input, context, "invalid", null, {
      cvr: input.cvr,
      status: null,
      startDate: null,
      endDate: null,
    });
  }
  const node = nodes[0];
  if (!isPlainRecord(node) || String(node.CVRNummer ?? "") !== input.cvr) {
    throw new Error("invalid provider response");
  }
  const providerReference = requiredText(node.id, 256);
  const status = requiredText(node.status, 120);
  const startDate = optionalIsoDate(node.virksomhedStartdato);
  const endDate = optionalIsoDate(node.virksomhedOphoersdato);
  return evidence(input, context, "valid", providerReference, {
    cvr: input.cvr,
    status,
    startDate,
    endDate,
  });
}

function evidence(
  input: DanishCompanyProviderInput,
  context: ProviderContext,
  status: "valid" | "invalid",
  providerReference: string | null,
  displayFields: Readonly<Record<string, string | null>>,
): BusinessProviderEvidence {
  return deepFreeze({
    schemaVersion: BUSINESS_EVIDENCE_SCHEMA_VERSION,
    provider: DATAFORDELER_CVR_PROVIDER,
    evidenceType: "danish_company" as const,
    normalizedIdentifier: input.normalizedIdentifier,
    resultStatus: status,
    providerReference,
    checkedAt: context.now.toISOString(),
    displayFields,
  });
}

function unavailable(
  input: { normalizedIdentifier?: unknown },
  context: ProviderContext,
): BusinessProviderEvidence {
  const identifier = typeof input?.normalizedIdentifier === "string" &&
      /^DK\d{8}$/.test(input.normalizedIdentifier)
    ? input.normalizedIdentifier
    : "DK00000000";
  return unavailableProviderEvidence(
    DATAFORDELER_CVR_PROVIDER,
    "danish_company",
    identifier,
    context.now,
  );
}

function isCompanyInput(input: unknown): input is DanishCompanyProviderInput {
  return isPlainRecord(input) &&
    input.kind === "danish_company" &&
    typeof input.cvr === "string" &&
    /^\d{8}$/.test(input.cvr) &&
    input.normalizedIdentifier === `DK${input.cvr}`;
}

function optionalIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("invalid provider response");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("invalid provider response");
  }
  return value;
}

function requiredText(value: unknown, maximum: number): string {
  if (typeof value !== "string") throw new Error("invalid provider response");
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > maximum || hasControlCharacter(text)) {
    throw new Error("invalid provider response");
  }
  return text;
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
