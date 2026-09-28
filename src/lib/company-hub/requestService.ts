import type { SupabaseClient } from "@supabase/supabase-js";

import type { SiteCheckoutState } from "../checkout/siteCheckoutSession";
import { buildCompanyHubCheckoutState } from "./checkout.ts";
import type {
  CompanyConsultantRequest,
  CompanyJson,
  CompanyOrderRequest,
  HubItem,
} from "./types";
import type { CompanyWorkspaceScope } from "./workspaceRepository";

export interface CompanyOrderRequestWithProduct extends CompanyOrderRequest {
  item_title?: string;
  product_name?: string;
  product_slug?: string;
  requires_approval?: boolean;
}

export interface CreateCompanyConsultantRequestInput {
  requestType: CompanyConsultantRequest["request_type"];
  subject: string;
  message: string;
  officeId?: string | null;
  itemId?: string | null;
  assetId?: string | null;
}

export interface PreparedCompanyCheckout {
  request: CompanyOrderRequest;
  checkoutState: SiteCheckoutState;
  requiresApproval: boolean;
}

function database(client: Pick<SupabaseClient, "from">) {
  return client as any;
}

function required(value: string | null | undefined, label: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} skal udfyldes.`);
  return normalized;
}

export function buildCompanyOrderConfiguration(state: SiteCheckoutState): CompanyJson {
  return {
    selectedVariant: state.selectedVariant || null,
    selectedFormat: state.selectedFormat || null,
    linkedTemplateId: state.linkedTemplateId || null,
    optionSelections: state.optionSelections || {},
    apparelConfig: state.apparelConfig || null,
    companyWorkingDesignId: state.companyWorkingDesignId || null,
  };
}

export async function prepareCompanyCheckout(
  client: SupabaseClient,
  state: SiteCheckoutState,
): Promise<PreparedCompanyCheckout> {
  const companyId = required(state.companyId, "Firma");
  const itemId = required(state.companyCatalogItemId, "Firmaprodukt");
  const temporaryRequestId = state.companyOrderRequestId || "pending-request";
  const validatedState = buildCompanyHubCheckoutState(state, {
    companyId,
    companyOfficeId: state.companyOfficeId,
    companyAddressId: state.companyAddressId,
    companyCatalogItemId: itemId,
    companyOrderRequestId: temporaryRequestId,
  });
  const configuration = buildCompanyOrderConfiguration(validatedState);

  const rpcName = state.companyOrderRequestId
    ? "company_hub_prepare_order_checkout"
    : "company_hub_create_order_request";
  const args = state.companyOrderRequestId
    ? {
      _request_id: state.companyOrderRequestId,
      _quantity: validatedState.quantity,
      _product_configuration: configuration,
      _quote_snapshot: validatedState.pricingQuote,
      _quoted_total: validatedState.totalPrice,
    }
    : {
      _company_id: companyId,
      _office_id: state.companyOfficeId || null,
      _item_id: itemId,
      _quantity: validatedState.quantity,
      _field_values: {},
      _product_configuration: configuration,
      _quote_snapshot: validatedState.pricingQuote,
      _quoted_total: validatedState.totalPrice,
      _address_snapshot: null,
    };
  const { data, error } = await (client as any).rpc(rpcName, args).single();
  if (error || !data) throw error || new Error("Firmaordren kunne ikke klargøres.");
  const request = data as CompanyOrderRequest;
  return {
    request,
    requiresApproval: request.status === "pending_approval",
    checkoutState: {
      ...validatedState,
      companyOrderRequestId: request.id,
    },
  };
}

export async function listCompanyOrderRequests(
  client: Pick<SupabaseClient, "from">,
  companyId: string,
): Promise<CompanyOrderRequestWithProduct[]> {
  const { data, error } = await database(client)
    .from("company_order_requests")
    .select(`
      *,
      item:company_hub_items(title, requires_approval),
      product:products(name, slug)
    `)
    .eq("company_id", required(companyId, "Firma"))
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => {
    const item = Array.isArray(row.item) ? row.item[0] : row.item;
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    return {
      ...row,
      item_title: item?.title || product?.name || "Tryksag",
      requires_approval: item?.requires_approval === true,
      product_name: product?.name || null,
      product_slug: product?.slug || null,
    };
  });
}

export async function decideCompanyOrderRequest(
  client: SupabaseClient,
  requestId: string,
  approve: boolean,
  reason?: string | null,
): Promise<CompanyOrderRequest> {
  const { data, error } = await (client as any)
    .rpc("company_hub_decide_order_request", {
      _request_id: required(requestId, "Bestillingsanmodning"),
      _approve: approve,
      _reason: String(reason || "").trim() || null,
    })
    .single();
  if (error || !data) throw error || new Error("Beslutningen kunne ikke gemmes.");
  return data;
}

export async function linkCompanyOrder(
  client: SupabaseClient,
  requestId: string,
  orderId: string,
): Promise<CompanyOrderRequest> {
  const { data, error } = await (client as any)
    .rpc("company_hub_link_order", {
      _request_id: required(requestId, "Bestillingsanmodning"),
      _order_id: required(orderId, "Ordre"),
    })
    .single();
  if (error || !data) throw error || new Error("Ordren kunne ikke forbindes med firmahubben.");
  return data;
}

export async function listCompanyConsultantRequests(
  client: Pick<SupabaseClient, "from">,
  companyId: string,
): Promise<CompanyConsultantRequest[]> {
  const { data, error } = await database(client)
    .from("company_consultant_requests")
    .select("*")
    .eq("company_id", required(companyId, "Firma"))
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createCompanyConsultantRequest(
  client: SupabaseClient,
  scope: CompanyWorkspaceScope,
  input: CreateCompanyConsultantRequestInput,
): Promise<CompanyConsultantRequest> {
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw authError || new Error("Du skal være logget ind.");
  const { data, error } = await database(client)
    .from("company_consultant_requests")
    .insert({
      tenant_id: scope.tenantId,
      company_id: scope.companyId,
      office_id: input.officeId || null,
      item_id: input.itemId || null,
      asset_id: input.assetId || null,
      request_type: input.requestType,
      subject: required(input.subject, "Emne"),
      message: required(input.message, "Besked"),
      status: "new",
      created_by: authData.user.id,
    })
    .select("*")
    .single();
  if (error || !data) throw error || new Error("Henvendelsen kunne ikke sendes.");
  return data;
}

export async function updateCompanyConsultantRequestStatus(
  client: Pick<SupabaseClient, "from">,
  scope: CompanyWorkspaceScope,
  requestId: string,
  status: CompanyConsultantRequest["status"],
): Promise<CompanyConsultantRequest> {
  const { data, error } = await database(client)
    .from("company_consultant_requests")
    .update({ status })
    .eq("id", required(requestId, "Henvendelse"))
    .eq("tenant_id", scope.tenantId)
    .eq("company_id", scope.companyId)
    .select("*")
    .single();
  if (error || !data) throw error || new Error("Henvendelsen kunne ikke opdateres.");
  return data;
}

export function findCompanyHubItemForRequest(items: HubItem[], request: CompanyOrderRequest): HubItem | null {
  return items.find((item) => item.id === request.item_id) || null;
}
