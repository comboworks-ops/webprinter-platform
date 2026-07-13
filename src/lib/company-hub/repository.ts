import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeCompanyRole } from "./access";
import type {
  CompanyAccount,
  CompanyAddress,
  CompanyCatalogCategory,
  CompanyJson,
  CompanyMembership,
  CompanyOffice,
  HubItem,
} from "./types";

export type CompanyHubRepositoryClient = Pick<SupabaseClient, "from">;

export class CompanyHubRepositoryError extends Error {
  readonly operation: string;
  readonly cause: unknown;

  constructor(operation: string, publicMessage: string, cause: unknown) {
    super(publicMessage);
    this.name = "CompanyHubRepositoryError";
    this.operation = operation;
    this.cause = cause;
  }
}

function database(client: CompanyHubRepositoryClient) {
  // Generated Supabase types are updated only after the migration is applied.
  // Keep the temporary untyped boundary here instead of spreading casts through UI code.
  return client as any;
}

function fail(operation: string, message: string, cause: unknown): never {
  throw new CompanyHubRepositoryError(operation, message, cause);
}

export async function listMyCompanyMemberships(
  client: CompanyHubRepositoryClient,
): Promise<CompanyMembership[]> {
  const { data, error } = await database(client)
    .from("company_members")
    .select(`
      company_id,
      tenant_id,
      user_id,
      role,
      status,
      is_all_offices,
      company:company_accounts(
        id,
        tenant_id,
        name,
        logo_url,
        slug,
        status,
        industry_key,
        contact_email,
        contact_phone,
        billing_email,
        settings,
        created_at,
        updated_at
      )
    `)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    fail("listMyCompanyMemberships", "Firmaadgangen kunne ikke indlæses.", error);
  }

  return (data || []).flatMap((row: any) => {
    const joined = Array.isArray(row.company) ? row.company[0] : row.company;
    if (!joined) return [];

    return [{
      ...(joined as CompanyAccount),
      membership_role: normalizeCompanyRole(row.role),
      membership_status: row.status === "disabled" ? "disabled" : "active",
      is_all_offices: row.is_all_offices !== false,
    } satisfies CompanyMembership];
  });
}

export async function listCompanyOffices(
  client: CompanyHubRepositoryClient,
  companyId: string,
  options: { includeInactive?: boolean } = {},
): Promise<CompanyOffice[]> {
  let query = database(client)
    .from("company_offices")
    .select(`
      id,
      tenant_id,
      company_id,
      name,
      code,
      email,
      phone,
      website,
      is_default,
      status,
      profile_data,
      created_at,
      updated_at
    `)
    .eq("company_id", companyId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (!options.includeInactive) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;
  if (error) {
    fail("listCompanyOffices", "Kontorerne kunne ikke indlæses.", error);
  }

  return (data || []) as CompanyOffice[];
}

export async function listCompanyAddresses(
  client: CompanyHubRepositoryClient,
  companyId: string,
  options: { officeId?: string | null; includeInactive?: boolean } = {},
): Promise<CompanyAddress[]> {
  let query = database(client)
    .from("company_addresses")
    .select(`
      id,
      tenant_id,
      company_id,
      office_id,
      type,
      label,
      recipient_name,
      company_name,
      street_address,
      street_address_2,
      postal_code,
      city,
      country_code,
      phone,
      is_default,
      status,
      created_at,
      updated_at
    `)
    .eq("company_id", companyId)
    .order("is_default", { ascending: false })
    .order("label", { ascending: true });

  if (!options.includeInactive) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;
  if (error) {
    fail("listCompanyAddresses", "Leveringsadresserne kunne ikke indlæses.", error);
  }

  const rows = (data || []) as CompanyAddress[];
  if (!options.officeId) return rows.filter((row) => row.office_id === null);
  return rows.filter((row) => row.office_id === null || row.office_id === options.officeId);
}

export async function listCompanyCategories(
  client: CompanyHubRepositoryClient,
  companyId: string,
  options: { includeDrafts?: boolean } = {},
): Promise<CompanyCatalogCategory[]> {
  let query = database(client)
    .from("company_catalog_categories")
    .select(`
      id,
      tenant_id,
      company_id,
      name,
      slug,
      description,
      icon_name,
      image_url,
      sort_order,
      status,
      created_at,
      updated_at
    `)
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!options.includeDrafts) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;
  if (error) {
    fail("listCompanyCategories", "Produktkategorierne kunne ikke indlæses.", error);
  }

  return (data || []) as CompanyCatalogCategory[];
}

export async function listCompanyCatalogItems(
  client: CompanyHubRepositoryClient,
  companyId: string,
  options: { includeDrafts?: boolean } = {},
): Promise<HubItem[]> {
  let query = database(client)
    .from("company_hub_items")
    .select(`
      id,
      tenant_id,
      company_id,
      title,
      product_id,
      variant_id,
      default_quantity,
      default_options,
      design_id,
      thumbnail_url,
      sort_order,
      status,
      short_description,
      category_id,
      template_binding_id,
      requires_approval,
      is_featured,
      office_scope,
      created_at,
      updated_at,
      product:products(id, name, slug, pricing_type)
    `)
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (!options.includeDrafts) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;
  if (error) {
    fail("listCompanyCatalogItems", "Firmaets produkter kunne ikke indlæses.", error);
  }

  return (data || []).map((row: any) => {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    const { product: _product, ...item } = row;
    return {
      ...item,
      default_options: (item.default_options || {}) as CompanyJson,
      product_name: product?.name || undefined,
      product_slug: product?.slug || undefined,
      product_pricing_type: product?.pricing_type || undefined,
    } as HubItem;
  });
}
