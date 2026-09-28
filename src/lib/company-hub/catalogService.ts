import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CompanyCatalogCategory,
  CompanyCatalogStatus,
  CompanyJson,
  CompanyOfficeScope,
  CompanyProductCandidate,
  HubItem,
} from "./types";
import type { CompanyWorkspaceScope } from "./workspaceRepository";

export interface CreateCompanyCatalogItemInput {
  productId: string;
  title: string;
  shortDescription?: string | null;
  categoryId?: string | null;
  thumbnailUrl?: string | null;
  defaultQuantity?: number;
  defaultOptions?: CompanyJson;
  requiresApproval?: boolean;
  isFeatured?: boolean;
  officeScope?: CompanyOfficeScope;
  status?: CompanyCatalogStatus;
  sortOrder?: number;
}

export interface UpdateCompanyCatalogItemInput {
  title?: string;
  shortDescription?: string | null;
  categoryId?: string | null;
  thumbnailUrl?: string | null;
  defaultQuantity?: number;
  defaultOptions?: CompanyJson;
  requiresApproval?: boolean;
  isFeatured?: boolean;
  officeScope?: CompanyOfficeScope;
  status?: CompanyCatalogStatus;
  sortOrder?: number;
}

export interface CreateCompanyCategoryInput {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  iconName?: string | null;
  sortOrder?: number;
}

function database(client: Pick<SupabaseClient, "from">) {
  return client as any;
}

function required(value: string | null | undefined, label: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} skal udfyldes.`);
  return normalized;
}

function optional(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function quantity(value: number | undefined): number {
  const normalized = Math.floor(Number(value ?? 100));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("Standardantal skal være et positivt heltal.");
  }
  return normalized;
}

function slugify(value: string): string {
  return required(value, "Kategorinavn")
    .toLocaleLowerCase("da-DK")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assertScope(scope: CompanyWorkspaceScope): void {
  required(scope.tenantId, "Tenant");
  required(scope.companyId, "Firma");
}

export function buildCompanyCatalogItemInsert(
  scope: CompanyWorkspaceScope,
  input: CreateCompanyCatalogItemInput,
) {
  assertScope(scope);
  return {
    tenant_id: scope.tenantId,
    company_id: scope.companyId,
    product_id: required(input.productId, "Produkt"),
    title: required(input.title, "Titel"),
    short_description: optional(input.shortDescription),
    category_id: optional(input.categoryId),
    thumbnail_url: optional(input.thumbnailUrl),
    default_quantity: quantity(input.defaultQuantity),
    default_options: input.defaultOptions || {},
    requires_approval: input.requiresApproval === true,
    is_featured: input.isFeatured === true,
    office_scope: input.officeScope || "all",
    status: input.status || "draft",
    sort_order: Math.floor(Number(input.sortOrder || 0)),
  };
}

export function buildCompanyCatalogItemUpdate(input: UpdateCompanyCatalogItemInput) {
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = required(input.title, "Titel");
  if (input.shortDescription !== undefined) payload.short_description = optional(input.shortDescription);
  if (input.categoryId !== undefined) payload.category_id = optional(input.categoryId);
  if (input.thumbnailUrl !== undefined) payload.thumbnail_url = optional(input.thumbnailUrl);
  if (input.defaultQuantity !== undefined) payload.default_quantity = quantity(input.defaultQuantity);
  if (input.defaultOptions !== undefined) payload.default_options = input.defaultOptions;
  if (input.requiresApproval !== undefined) payload.requires_approval = input.requiresApproval;
  if (input.isFeatured !== undefined) payload.is_featured = input.isFeatured;
  if (input.officeScope !== undefined) payload.office_scope = input.officeScope;
  if (input.status !== undefined) payload.status = input.status;
  if (input.sortOrder !== undefined) payload.sort_order = Math.floor(Number(input.sortOrder));
  return payload;
}

export async function listEligibleCompanyProducts(
  client: Pick<SupabaseClient, "from">,
  tenantId: string,
): Promise<CompanyProductCandidate[]> {
  const { data, error } = await database(client)
    .from("products")
    .select("id, tenant_id, name, slug, description, category, pricing_type, image_url, is_published, default_quantity")
    .eq("tenant_id", required(tenantId, "Tenant"))
    .eq("is_published", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createCompanyCatalogItem(
  client: Pick<SupabaseClient, "from">,
  scope: CompanyWorkspaceScope,
  input: CreateCompanyCatalogItemInput,
): Promise<HubItem> {
  const { data, error } = await database(client)
    .from("company_hub_items")
    .insert(buildCompanyCatalogItemInsert(scope, input))
    .select("*")
    .single();
  if (error || !data) throw error || new Error("Produktet kunne ikke tilføjes til firmaet.");
  return data;
}

export async function updateCompanyCatalogItem(
  client: Pick<SupabaseClient, "from">,
  scope: CompanyWorkspaceScope,
  itemId: string,
  input: UpdateCompanyCatalogItemInput,
): Promise<HubItem> {
  assertScope(scope);
  const { data, error } = await database(client)
    .from("company_hub_items")
    .update(buildCompanyCatalogItemUpdate(input))
    .eq("id", required(itemId, "Firmaprodukt"))
    .eq("tenant_id", scope.tenantId)
    .eq("company_id", scope.companyId)
    .select("*")
    .single();
  if (error || !data) throw error || new Error("Firmaproduktet kunne ikke gemmes.");
  return data;
}

export function archiveCompanyCatalogItem(
  client: Pick<SupabaseClient, "from">,
  scope: CompanyWorkspaceScope,
  itemId: string,
): Promise<HubItem> {
  return updateCompanyCatalogItem(client, scope, itemId, { status: "archived", isFeatured: false });
}

export async function replaceCompanyCatalogItemOffices(
  client: Pick<SupabaseClient, "from">,
  scope: CompanyWorkspaceScope,
  itemId: string,
  officeIds: string[],
): Promise<void> {
  assertScope(scope);
  const normalizedItemId = required(itemId, "Firmaprodukt");
  const uniqueOfficeIds = [...new Set(officeIds.filter(Boolean))];
  const { error: clearError } = await database(client)
    .from("company_catalog_item_offices")
    .delete()
    .eq("tenant_id", scope.tenantId)
    .eq("company_id", scope.companyId)
    .eq("item_id", normalizedItemId);
  if (clearError) throw clearError;

  if (!uniqueOfficeIds.length) return;
  const { error } = await database(client)
    .from("company_catalog_item_offices")
    .insert(uniqueOfficeIds.map((officeId) => ({
      tenant_id: scope.tenantId,
      company_id: scope.companyId,
      item_id: normalizedItemId,
      office_id: officeId,
    })));
  if (error) throw error;
}

export async function createCompanyCatalogCategory(
  client: Pick<SupabaseClient, "from">,
  scope: CompanyWorkspaceScope,
  input: CreateCompanyCategoryInput,
): Promise<CompanyCatalogCategory> {
  assertScope(scope);
  const name = required(input.name, "Kategorinavn");
  const { data, error } = await database(client)
    .from("company_catalog_categories")
    .insert({
      tenant_id: scope.tenantId,
      company_id: scope.companyId,
      name,
      slug: slugify(name),
      description: optional(input.description),
      image_url: optional(input.imageUrl),
      icon_name: optional(input.iconName),
      sort_order: Math.floor(Number(input.sortOrder || 0)),
      status: "active",
    })
    .select("*")
    .single();
  if (error || !data) throw error || new Error("Kategorien kunne ikke oprettes.");
  return data;
}
