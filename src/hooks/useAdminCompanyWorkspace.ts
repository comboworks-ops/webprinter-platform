import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  archiveCompanyAddress,
  archiveCompanyOffice,
  createCompanyAddress,
  createCompanyOffice,
  listCompanyAddresses,
  listCompanyCatalogItems,
  listCompanyOffices,
  normalizeCompanyRole,
  updateCompanyAddress,
  updateCompanyOffice,
  type CompanyAccount,
  type CompanyAddress,
  type CompanyMember,
  type CompanyOffice,
  type CompanyRole,
  type CompanyWorkspaceScope,
  type CreateCompanyAddressInput,
  type CreateCompanyOfficeInput,
  type HubItem,
  type UpdateCompanyAddressInput,
  type UpdateCompanyOfficeInput,
} from "@/lib/company-hub";

const database = supabase as any;

export interface AdminCompanyMember extends CompanyMember {
  user_name: string;
  user_email?: string;
  office_ids: string[];
}

export interface TenantCompanyUser {
  id: string;
  name: string;
  email?: string;
}

export interface CompanySetupMetrics {
  templateCount: number;
  orderRequestCount: number;
}

export interface CompanyIdentityInput {
  name: string;
  slug?: string | null;
  industryKey?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  billingEmail?: string | null;
  logoUrl?: string | null;
  status?: CompanyAccount["status"];
}

export interface SaveCompanyMemberInput {
  userId: string;
  role: CompanyRole;
  isAllOffices: boolean;
  officeIds: string[];
}

const adminCompanyKeys = {
  root: (tenantId: string) => ["admin-company-hub-v2", tenantId] as const,
  companies: (tenantId: string) => [...adminCompanyKeys.root(tenantId), "companies"] as const,
  offices: (tenantId: string, companyId: string | null) => [
    ...adminCompanyKeys.root(tenantId), "offices", companyId,
  ] as const,
  addresses: (tenantId: string, companyId: string | null) => [
    ...adminCompanyKeys.root(tenantId), "addresses", companyId,
  ] as const,
  members: (tenantId: string, companyId: string | null) => [
    ...adminCompanyKeys.root(tenantId), "members", companyId,
  ] as const,
  catalog: (tenantId: string, companyId: string | null) => [
    ...adminCompanyKeys.root(tenantId), "catalog", companyId,
  ] as const,
  metrics: (tenantId: string, companyId: string | null) => [
    ...adminCompanyKeys.root(tenantId), "metrics", companyId,
  ] as const,
  users: (tenantId: string) => [...adminCompanyKeys.root(tenantId), "users"] as const,
};

function required(value: string | null | undefined, label: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} skal udfyldes.`);
  return normalized;
}

function optional(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function companyPayload(input: CompanyIdentityInput) {
  return {
    name: required(input.name, "Firmanavn"),
    slug: optional(input.slug),
    industry_key: optional(input.industryKey),
    contact_email: optional(input.contactEmail),
    contact_phone: optional(input.contactPhone),
    billing_email: optional(input.billingEmail),
    logo_url: optional(input.logoUrl),
    status: input.status || "active",
  };
}

async function loadMembers(tenantId: string, companyId: string): Promise<AdminCompanyMember[]> {
  const [{ data: members, error: membersError }, { data: scopes, error: scopesError }] = await Promise.all([
    database
      .from("company_members")
      .select(`
        company_id,
        tenant_id,
        user_id,
        role,
        status,
        is_all_offices,
        created_at,
        updated_at,
        profile:profiles(first_name, last_name, email)
      `)
      .eq("tenant_id", tenantId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
    database
      .from("company_member_offices")
      .select("user_id, office_id")
      .eq("tenant_id", tenantId)
      .eq("company_id", companyId),
  ]);

  if (membersError) throw membersError;
  if (scopesError) throw scopesError;

  const officeIdsByUser = new Map<string, string[]>();
  for (const row of scopes || []) {
    const current = officeIdsByUser.get(row.user_id) || [];
    current.push(row.office_id);
    officeIdsByUser.set(row.user_id, current);
  }

  return (members || []).map((row: any) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const fullName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
    return {
      ...row,
      role: normalizeCompanyRole(row.role),
      status: row.status === "disabled" ? "disabled" : "active",
      is_all_offices: row.is_all_offices !== false,
      user_name: fullName || profile?.email || "Navn mangler",
      user_email: profile?.email || undefined,
      office_ids: officeIdsByUser.get(row.user_id) || [],
    } as AdminCompanyMember;
  });
}

async function loadTenantUsers(tenantId: string): Promise<TenantCompanyUser[]> {
  const { data, error } = await database
    .from("user_roles")
    .select(`
      user_id,
      profile:profiles(first_name, last_name, email)
    `)
    .eq("tenant_id", tenantId);

  if (error) throw error;
  return (data || []).map((row: any) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const fullName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
    return {
      id: row.user_id,
      name: fullName || profile?.email || "Bruger uden navn",
      email: profile?.email || undefined,
    };
  });
}

export function useAdminCompanyWorkspace(tenantId: string, selectedCompanyId: string | null) {
  const queryClient = useQueryClient();
  const scope: CompanyWorkspaceScope | null = selectedCompanyId
    ? { tenantId, companyId: selectedCompanyId }
    : null;

  const requireScope = (): CompanyWorkspaceScope => {
    if (!scope) throw new Error("Vælg et firma først.");
    return scope;
  };

  const companiesQuery = useQuery({
    queryKey: adminCompanyKeys.companies(tenantId),
    queryFn: async (): Promise<CompanyAccount[]> => {
      const { data, error } = await database
        .from("company_accounts")
        .select("id, tenant_id, name, logo_url, slug, status, industry_key, contact_email, contact_phone, billing_email, settings, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .neq("status", "archived")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(tenantId),
  });

  const officesQuery = useQuery({
    queryKey: adminCompanyKeys.offices(tenantId, selectedCompanyId),
    queryFn: () => listCompanyOffices(database, selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const addressesQuery = useQuery({
    queryKey: adminCompanyKeys.addresses(tenantId, selectedCompanyId),
    queryFn: () => listCompanyAddresses(database, selectedCompanyId!, { includeAllOffices: true }),
    enabled: Boolean(selectedCompanyId),
  });

  const membersQuery = useQuery({
    queryKey: adminCompanyKeys.members(tenantId, selectedCompanyId),
    queryFn: () => loadMembers(tenantId, selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const catalogQuery = useQuery({
    queryKey: adminCompanyKeys.catalog(tenantId, selectedCompanyId),
    queryFn: () => listCompanyCatalogItems(database, selectedCompanyId!, { includeDrafts: true }),
    enabled: Boolean(selectedCompanyId),
  });

  const metricsQuery = useQuery({
    queryKey: adminCompanyKeys.metrics(tenantId, selectedCompanyId),
    queryFn: async (): Promise<CompanySetupMetrics> => {
      const [templates, orderRequests] = await Promise.all([
        database
          .from("company_template_bindings")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("company_id", selectedCompanyId!),
        database
          .from("company_order_requests")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("company_id", selectedCompanyId!),
      ]);
      if (templates.error) throw templates.error;
      if (orderRequests.error) throw orderRequests.error;
      return {
        templateCount: templates.count || 0,
        orderRequestCount: orderRequests.count || 0,
      };
    },
    enabled: Boolean(selectedCompanyId),
  });

  const tenantUsersQuery = useQuery({
    queryKey: adminCompanyKeys.users(tenantId),
    queryFn: () => loadTenantUsers(tenantId),
    enabled: Boolean(tenantId),
  });

  const invalidateCompany = async () => {
    await queryClient.invalidateQueries({ queryKey: adminCompanyKeys.companies(tenantId) });
  };

  const invalidateLocations = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminCompanyKeys.offices(tenantId, selectedCompanyId) }),
      queryClient.invalidateQueries({ queryKey: adminCompanyKeys.addresses(tenantId, selectedCompanyId) }),
    ]);
  };

  const createCompanyMutation = useMutation({
    mutationFn: async (input: CompanyIdentityInput): Promise<CompanyAccount> => {
      const { data, error } = await database
        .from("company_accounts")
        .insert({ tenant_id: tenantId, ...companyPayload(input) })
        .select("*")
        .single();
      if (error || !data) throw error || new Error("Firmaet kunne ikke oprettes.");
      return data;
    },
    onSuccess: invalidateCompany,
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ companyId, input }: { companyId: string; input: CompanyIdentityInput }) => {
      const { data, error } = await database
        .from("company_accounts")
        .update(companyPayload(input))
        .eq("id", companyId)
        .eq("tenant_id", tenantId)
        .select("*")
        .single();
      if (error || !data) throw error || new Error("Firmaet kunne ikke gemmes.");
      return data as CompanyAccount;
    },
    onSuccess: invalidateCompany,
  });

  const createOfficeMutation = useMutation({
    mutationFn: (input: CreateCompanyOfficeInput) => createCompanyOffice(database, requireScope(), input),
    onSuccess: invalidateLocations,
  });
  const updateOfficeMutation = useMutation({
    mutationFn: ({ officeId, input }: { officeId: string; input: UpdateCompanyOfficeInput }) => (
      updateCompanyOffice(database, requireScope(), officeId, input)
    ),
    onSuccess: invalidateLocations,
  });
  const archiveOfficeMutation = useMutation({
    mutationFn: (officeId: string) => archiveCompanyOffice(database, requireScope(), officeId),
    onSuccess: invalidateLocations,
  });
  const createAddressMutation = useMutation({
    mutationFn: (input: CreateCompanyAddressInput) => createCompanyAddress(database, requireScope(), input),
    onSuccess: invalidateLocations,
  });
  const updateAddressMutation = useMutation({
    mutationFn: ({ addressId, input }: { addressId: string; input: UpdateCompanyAddressInput }) => (
      updateCompanyAddress(database, requireScope(), addressId, input)
    ),
    onSuccess: invalidateLocations,
  });
  const archiveAddressMutation = useMutation({
    mutationFn: (addressId: string) => archiveCompanyAddress(database, requireScope(), addressId),
    onSuccess: invalidateLocations,
  });

  const saveMemberMutation = useMutation({
    mutationFn: async (input: SaveCompanyMemberInput) => {
      const currentScope = requireScope();
      const officeIds = [...new Set(input.officeIds.filter(Boolean))];
      if (!input.isAllOffices && officeIds.length === 0) {
        throw new Error("Vælg mindst ét kontor til medlemmet.");
      }

      const { error: memberError } = await database
        .from("company_members")
        .upsert({
          tenant_id: currentScope.tenantId,
          company_id: currentScope.companyId,
          user_id: input.userId,
          role: input.role,
          status: "active",
          is_all_offices: input.isAllOffices,
        }, { onConflict: "company_id,user_id" });
      if (memberError) throw memberError;

      const { error: clearError } = await database
        .from("company_member_offices")
        .delete()
        .eq("tenant_id", currentScope.tenantId)
        .eq("company_id", currentScope.companyId)
        .eq("user_id", input.userId);
      if (clearError) throw clearError;

      if (!input.isAllOffices) {
        const { error: scopeError } = await database
          .from("company_member_offices")
          .insert(officeIds.map((officeId) => ({
            tenant_id: currentScope.tenantId,
            company_id: currentScope.companyId,
            user_id: input.userId,
            office_id: officeId,
          })));
        if (scopeError) throw scopeError;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: adminCompanyKeys.members(tenantId, selectedCompanyId),
    }),
  });

  const disableMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const currentScope = requireScope();
      const { error } = await database
        .from("company_members")
        .update({ status: "disabled", is_all_offices: false })
        .eq("tenant_id", currentScope.tenantId)
        .eq("company_id", currentScope.companyId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: adminCompanyKeys.members(tenantId, selectedCompanyId),
    }),
  });

  return {
    companiesQuery,
    officesQuery,
    addressesQuery,
    membersQuery,
    catalogQuery,
    metricsQuery,
    tenantUsersQuery,
    createCompanyMutation,
    updateCompanyMutation,
    createOfficeMutation,
    updateOfficeMutation,
    archiveOfficeMutation,
    createAddressMutation,
    updateAddressMutation,
    archiveAddressMutation,
    saveMemberMutation,
    disableMemberMutation,
  };
}
