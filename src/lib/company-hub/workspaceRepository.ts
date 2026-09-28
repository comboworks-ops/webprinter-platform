import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CompanyAddress,
  CompanyAddressType,
  CompanyJson,
  CompanyOffice,
} from "./types";

export interface CompanyWorkspaceScope {
  tenantId: string;
  companyId: string;
}

export interface CreateCompanyOfficeInput {
  name: string;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  isDefault?: boolean;
  profileData?: CompanyJson;
}

export interface UpdateCompanyOfficeInput {
  name?: string;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  isDefault?: boolean;
  profileData?: CompanyJson;
  status?: "active" | "disabled" | "archived";
}

export interface CreateCompanyAddressInput {
  officeId?: string | null;
  type: CompanyAddressType;
  label: string;
  recipientName: string;
  companyName?: string | null;
  streetAddress: string;
  streetAddress2?: string | null;
  postalCode: string;
  city: string;
  countryCode?: string;
  phone?: string | null;
  isDefault?: boolean;
}

export interface UpdateCompanyAddressInput {
  officeId?: string | null;
  type?: CompanyAddressType;
  label?: string;
  recipientName?: string;
  companyName?: string | null;
  streetAddress?: string;
  streetAddress2?: string | null;
  postalCode?: string;
  city?: string;
  countryCode?: string;
  phone?: string | null;
  isDefault?: boolean;
  status?: "active" | "disabled" | "archived";
}

export class CompanyWorkspaceRepositoryError extends Error {
  readonly operation: string;
  readonly cause: unknown;

  constructor(operation: string, publicMessage: string, cause?: unknown) {
    super(publicMessage);
    this.name = "CompanyWorkspaceRepositoryError";
    this.operation = operation;
    this.cause = cause;
  }
}

function database(client: Pick<SupabaseClient, "from">) {
  return client as any;
}

function required(value: string | null | undefined, label: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new CompanyWorkspaceRepositoryError("validate", `${label} skal udfyldes.`);
  }
  return normalized;
}

function optional(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function assertScope(scope: CompanyWorkspaceScope): void {
  if (!String(scope.tenantId || "").trim()) {
    throw new CompanyWorkspaceRepositoryError("validateScope", "Tenant mangler for firmaarbejdsområdet.");
  }
  if (!String(scope.companyId || "").trim()) {
    throw new CompanyWorkspaceRepositoryError("validateScope", "Firma mangler for arbejdsområdet.");
  }
}

export function buildCompanyOfficeInsert(
  scope: CompanyWorkspaceScope,
  input: CreateCompanyOfficeInput,
) {
  assertScope(scope);
  return {
    tenant_id: scope.tenantId,
    company_id: scope.companyId,
    name: required(input.name, "Kontorets navn"),
    code: optional(input.code),
    email: optional(input.email),
    phone: optional(input.phone),
    website: optional(input.website),
    is_default: input.isDefault === true,
    profile_data: input.profileData || {},
    status: "active" as const,
  };
}

export function buildCompanyOfficeUpdate(input: UpdateCompanyOfficeInput) {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = required(input.name, "Kontorets navn");
  if (input.code !== undefined) payload.code = optional(input.code);
  if (input.email !== undefined) payload.email = optional(input.email);
  if (input.phone !== undefined) payload.phone = optional(input.phone);
  if (input.website !== undefined) payload.website = optional(input.website);
  if (input.isDefault !== undefined) payload.is_default = input.isDefault;
  if (input.profileData !== undefined) payload.profile_data = input.profileData;
  if (input.status !== undefined) payload.status = input.status;
  return payload;
}

export function buildCompanyAddressInsert(
  scope: CompanyWorkspaceScope,
  input: CreateCompanyAddressInput,
) {
  assertScope(scope);
  return {
    tenant_id: scope.tenantId,
    company_id: scope.companyId,
    office_id: optional(input.officeId),
    type: input.type,
    label: required(input.label, "Adressens navn"),
    recipient_name: required(input.recipientName, "Modtagerens navn"),
    company_name: optional(input.companyName),
    street_address: required(input.streetAddress, "Adresse"),
    street_address_2: optional(input.streetAddress2),
    postal_code: required(input.postalCode, "Postnummer"),
    city: required(input.city, "By"),
    country_code: required(input.countryCode || "DK", "Landekode").toUpperCase(),
    phone: optional(input.phone),
    is_default: input.isDefault === true,
    status: "active" as const,
  };
}

export function buildCompanyAddressUpdate(input: UpdateCompanyAddressInput) {
  const payload: Record<string, unknown> = {};
  if (input.officeId !== undefined) payload.office_id = optional(input.officeId);
  if (input.type !== undefined) payload.type = input.type;
  if (input.label !== undefined) payload.label = required(input.label, "Adressens navn");
  if (input.recipientName !== undefined) payload.recipient_name = required(input.recipientName, "Modtagerens navn");
  if (input.companyName !== undefined) payload.company_name = optional(input.companyName);
  if (input.streetAddress !== undefined) payload.street_address = required(input.streetAddress, "Adresse");
  if (input.streetAddress2 !== undefined) payload.street_address_2 = optional(input.streetAddress2);
  if (input.postalCode !== undefined) payload.postal_code = required(input.postalCode, "Postnummer");
  if (input.city !== undefined) payload.city = required(input.city, "By");
  if (input.countryCode !== undefined) payload.country_code = required(input.countryCode, "Landekode").toUpperCase();
  if (input.phone !== undefined) payload.phone = optional(input.phone);
  if (input.isDefault !== undefined) payload.is_default = input.isDefault;
  if (input.status !== undefined) payload.status = input.status;
  return payload;
}

async function runSingle<T>(
  operation: string,
  publicMessage: string,
  query: PromiseLike<{ data: T | null; error: unknown }>,
): Promise<T> {
  const { data, error } = await query;
  if (error || !data) {
    throw new CompanyWorkspaceRepositoryError(operation, publicMessage, error);
  }
  return data;
}

export function createCompanyOffice(
  client: Pick<SupabaseClient, "from">,
  scope: CompanyWorkspaceScope,
  input: CreateCompanyOfficeInput,
): Promise<CompanyOffice> {
  const payload = buildCompanyOfficeInsert(scope, input);
  return runSingle(
    "createCompanyOffice",
    "Kontoret kunne ikke oprettes.",
    database(client).from("company_offices").insert(payload).select("*").single(),
  );
}

export function updateCompanyOffice(
  client: Pick<SupabaseClient, "from">,
  scope: CompanyWorkspaceScope,
  officeId: string,
  input: UpdateCompanyOfficeInput,
): Promise<CompanyOffice> {
  assertScope(scope);
  return runSingle(
    "updateCompanyOffice",
    "Kontoret kunne ikke gemmes.",
    database(client)
      .from("company_offices")
      .update(buildCompanyOfficeUpdate(input))
      .eq("id", required(officeId, "Kontor"))
      .eq("tenant_id", scope.tenantId)
      .eq("company_id", scope.companyId)
      .select("*")
      .single(),
  );
}

export function archiveCompanyOffice(
  client: Pick<SupabaseClient, "from">,
  scope: CompanyWorkspaceScope,
  officeId: string,
): Promise<CompanyOffice> {
  return updateCompanyOffice(client, scope, officeId, { status: "archived", isDefault: false });
}

export function createCompanyAddress(
  client: Pick<SupabaseClient, "from">,
  scope: CompanyWorkspaceScope,
  input: CreateCompanyAddressInput,
): Promise<CompanyAddress> {
  const payload = buildCompanyAddressInsert(scope, input);
  return runSingle(
    "createCompanyAddress",
    "Adressen kunne ikke oprettes.",
    database(client).from("company_addresses").insert(payload).select("*").single(),
  );
}

export function updateCompanyAddress(
  client: Pick<SupabaseClient, "from">,
  scope: CompanyWorkspaceScope,
  addressId: string,
  input: UpdateCompanyAddressInput,
): Promise<CompanyAddress> {
  assertScope(scope);
  return runSingle(
    "updateCompanyAddress",
    "Adressen kunne ikke gemmes.",
    database(client)
      .from("company_addresses")
      .update(buildCompanyAddressUpdate(input))
      .eq("id", required(addressId, "Adresse"))
      .eq("tenant_id", scope.tenantId)
      .eq("company_id", scope.companyId)
      .select("*")
      .single(),
  );
}

export function archiveCompanyAddress(
  client: Pick<SupabaseClient, "from">,
  scope: CompanyWorkspaceScope,
  addressId: string,
): Promise<CompanyAddress> {
  return updateCompanyAddress(client, scope, addressId, { status: "archived", isDefault: false });
}
