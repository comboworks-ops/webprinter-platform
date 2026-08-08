export const DANISH_BUSINESS_IDENTITY_SCHEMA_VERSION = 1 as const;

export type BusinessEvidenceStatus =
  | "unknown"
  | "pending"
  | "valid"
  | "invalid"
  | "unavailable"
  | "stale";

export type DanishStructuredAddress = Readonly<{
  streetName: string;
  houseNumber: string;
  floor: string;
  door: string;
  postcode: string;
  city: string;
  country: "DK";
}>;

export type DanishBusinessIdentityDraft = Readonly<{
  cvrInput: string;
  address: DanishStructuredAddress;
  legacyAddressWasParsed: boolean;
}>;

export type TenantOperationScope = Readonly<{
  tenantId: string | null;
  generation: number;
}>;

type PlainRecord = Record<string, unknown>;

const EVIDENCE_STATES = new Set<BusinessEvidenceStatus>([
  "unknown",
  "pending",
  "valid",
  "invalid",
  "unavailable",
  "stale",
]);

const EVIDENCE_LABELS: Record<BusinessEvidenceStatus, string> = {
  unknown: "Ikke kontrolleret",
  pending: "Kontrol i gang",
  valid: "Bekræftet af udbyderen",
  invalid: "Ikke bekræftet af udbyderen",
  unavailable: "Kontroltjenesten er midlertidigt utilgængelig",
  stale: "Kontrollen bør gentages",
};

export function normalizeDanishCvr(input: unknown) {
  const value = typeof input === "string" ? input.trim().slice(0, 80) : "";
  const compact = value.replace(/[ -]/g, "");
  const normalizedCvr = /^\d{8}$/.test(compact) ? compact : null;

  return Object.freeze({
    input: value,
    normalizedCvr,
    viesCountryCode: normalizedCvr ? ("DK" as const) : null,
    viesVatNumber: normalizedCvr,
    viesVatId: normalizedCvr ? `DK${normalizedCvr}` : null,
    canVerify: normalizedCvr !== null,
  });
}

export function normalizeStructuredDanishAddress(input: unknown): Readonly<{
  valid: boolean;
  value: DanishStructuredAddress;
}> {
  const record = isPlainRecord(input) ? input : {};
  const countryIsDk = typeof record.country === "string" &&
    record.country.trim().toUpperCase() === "DK";
  const value: DanishStructuredAddress = Object.freeze({
    streetName: boundedText(record.streetName, 120),
    houseNumber: boundedText(record.houseNumber, 12),
    floor: boundedText(record.floor, 20),
    door: boundedText(record.door, 20),
    postcode: boundedText(record.postcode, 4),
    city: boundedText(record.city, 80),
    country: "DK",
  });
  const valid = value.streetName.length > 0 &&
    /^\d{1,4}[A-Za-z]?$/.test(value.houseNumber) &&
    /^\d{4}$/.test(value.postcode) &&
    value.city.length > 0 &&
    countryIsDk &&
    isOptionalAddressPart(value.floor) &&
    isOptionalAddressPart(value.door);

  return Object.freeze({ valid, value });
}

export function parseLegacyDanishAddress(
  input: unknown,
): DanishStructuredAddress | null {
  if (typeof input !== "string") return null;
  const text = input.replace(/\r\n?/g, "\n").trim();
  if (!text || text.length > 300 || /\b(?:eller|or)\b/i.test(text)) {
    return null;
  }
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (lines.length !== 2) return null;

  const streetMatch = /^(.+?)\s+(\d{1,4}[A-Za-z]?)(?:,\s*(.+))?$/.exec(
    lines[0],
  );
  const cityMatch = /^(\d{4})\s+(.+)$/.exec(lines[1]);
  if (!streetMatch || !cityMatch) return null;

  const unit = parseFloorDoor(streetMatch[3] ?? "");
  if (unit === null) return null;
  const normalized = normalizeStructuredDanishAddress({
    streetName: streetMatch[1],
    houseNumber: streetMatch[2],
    floor: unit.floor,
    door: unit.door,
    postcode: cityMatch[1],
    city: cityMatch[2],
    country: "DK",
  });
  return normalized.valid ? normalized.value : null;
}

export function createDanishBusinessIdentityDraft(
  companyInput: unknown,
): DanishBusinessIdentityDraft {
  const company = isPlainRecord(companyInput) ? companyInput : {};
  const storedCandidate = isPlainRecord(company.business_identity_v1)
    ? company.business_identity_v1
    : null;
  const stored = storedCandidate?.schemaVersion ===
      DANISH_BUSINESS_IDENTITY_SCHEMA_VERSION
    ? storedCandidate
    : null;
  const storedAddress = stored && isPlainRecord(stored.address)
    ? normalizeStructuredDanishAddress(stored.address).value
    : null;
  const parsedLegacyAddress = storedAddress
    ? null
    : parseLegacyDanishAddress(company.address);
  const cvrInput = stored && typeof stored.cvrInput === "string"
    ? stored.cvrInput.trim().slice(0, 80)
    : normalizeDanishCvr(company.cvr).input;

  return Object.freeze({
    cvrInput,
    address: storedAddress ?? parsedLegacyAddress ?? emptyAddress(),
    legacyAddressWasParsed: parsedLegacyAddress !== null,
  });
}

export function canVerifyDanishBusinessIdentity(
  input: DanishBusinessIdentityDraft,
): boolean {
  return normalizeDanishCvr(input?.cvrInput).canVerify;
}

export function readSavedStructuredViesIdentifier(
  companyInput: unknown,
): string | null {
  const company = isPlainRecord(companyInput) ? companyInput : null;
  const identity = company && isPlainRecord(company.business_identity_v1)
    ? company.business_identity_v1
    : null;
  if (identity?.schemaVersion !== DANISH_BUSINESS_IDENTITY_SCHEMA_VERSION) {
    return null;
  }
  const normalizedCvr = typeof identity.normalizedCvr === "string"
    ? identity.normalizedCvr
    : "";
  const viesVatId = typeof identity.viesVatId === "string"
    ? identity.viesVatId
    : "";
  return /^\d{8}$/.test(normalizedCvr) && viesVatId === `DK${normalizedCvr}`
    ? viesVatId
    : null;
}

export function isCurrentTenantOperation(
  captured: TenantOperationScope,
  current: TenantOperationScope,
): boolean {
  return captured.tenantId !== null &&
    captured.tenantId === current.tenantId &&
    Number.isSafeInteger(captured.generation) &&
    captured.generation === current.generation;
}

export function buildTenantSettingsUpdate<T>(
  settings: T,
  companyName: string,
): Readonly<{ settings: T; name: string }> {
  return Object.freeze({
    settings,
    name: companyName.trim(),
  });
}

export function readEditableCompanyName(
  companyInput: unknown,
  tenantNameInput: unknown,
): string {
  const company = isPlainRecord(companyInput) ? companyInput : null;
  if (company && Object.prototype.hasOwnProperty.call(company, "name")) {
    return typeof company.name === "string" ? company.name : "";
  }
  return typeof tenantNameInput === "string" ? tenantNameInput : "";
}

export function mergeDanishBusinessIdentitySettings(
  currentSettingsInput: unknown,
  input: Readonly<{
    companyPatch: PlainRecord;
    identity: DanishBusinessIdentityDraft;
  }>,
): PlainRecord & { company: PlainRecord } {
  const currentSettings = isPlainRecord(currentSettingsInput)
    ? currentSettingsInput
    : {};
  const currentCompany = isPlainRecord(currentSettings.company)
    ? currentSettings.company
    : {};
  const companyPatch = isPlainRecord(input?.companyPatch)
    ? input.companyPatch
    : {};
  const cvr = normalizeDanishCvr(input?.identity?.cvrInput);
  const address =
    normalizeStructuredDanishAddress(input?.identity?.address).value;

  return {
    ...currentSettings,
    company: {
      ...currentCompany,
      ...companyPatch,
      business_identity_v1: {
        schemaVersion: DANISH_BUSINESS_IDENTITY_SCHEMA_VERSION,
        cvrInput: cvr.input,
        normalizedCvr: cvr.normalizedCvr,
        viesVatId: cvr.viesVatId,
        address,
      },
    },
  };
}

export function normalizeBusinessEvidenceState(input: unknown) {
  const status: BusinessEvidenceStatus = typeof input === "string" &&
      EVIDENCE_STATES.has(input as BusinessEvidenceStatus)
    ? (input as BusinessEvidenceStatus)
    : "unknown";
  return Object.freeze({
    status,
    label: EVIDENCE_LABELS[status],
    effect: "display_only" as const,
    blocksSave: false as const,
    changesVat: false as const,
    changesCheckout: false as const,
    changesTenantAccess: false as const,
  });
}

function emptyAddress(): DanishStructuredAddress {
  return Object.freeze({
    streetName: "",
    houseNumber: "",
    floor: "",
    door: "",
    postcode: "",
    city: "",
    country: "DK",
  });
}

function parseFloorDoor(value: string): { floor: string; door: string } | null {
  const compact = value.trim();
  if (!compact) return { floor: "", door: "" };
  const parts = compact.split(/\s+/);
  if (parts.length > 2) return null;
  return { floor: parts[0], door: parts[1] ?? "" };
}

function boundedText(value: unknown, maximum: number): string {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maximum ? normalized : "";
}

function isOptionalAddressPart(value: string): boolean {
  if (value.length > 20) return false;
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) return false;
  }
  return true;
}

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
