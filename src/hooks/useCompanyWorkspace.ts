import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  archiveCompanyAddress,
  archiveCompanyAsset,
  archiveCompanyOffice,
  createCompanyAssetSignedUrl,
  createCompanyConsultantRequest,
  createCompanyAddress,
  createCompanyOffice,
  detectCompanyHubV2,
  listCompanyAddresses,
  listCompanyAssets,
  listCompanyConsultantRequests,
  listCompanyCatalogItems,
  listCompanyCatalogItemOfficeIds,
  listCompanyCategories,
  listCompanyOffices,
  listCompanyOrderRequests,
  listCompanyTemplateBindings,
  listMyCompanyMemberships,
  createCompanyWorkingDesign,
  decideCompanyOrderRequest,
  uploadCompanyAsset,
  updateCompanyAddress,
  updateCompanyOffice,
  type CompanyHubRepositoryClient,
  type CompanyAsset,
  type CompanyAssetUploadInput,
  type CreateCompanyConsultantRequestInput,
  type CompanyWorkspaceScope,
  type CreateCompanyAddressInput,
  type CreateCompanyOfficeInput,
  type UpdateCompanyAddressInput,
  type UpdateCompanyOfficeInput,
} from "@/lib/company-hub";

const repositoryClient = supabase as unknown as CompanyHubRepositoryClient;

export const companyWorkspaceKeys = {
  root: ["company-hub-v2"] as const,
  capability: () => [...companyWorkspaceKeys.root, "capability"] as const,
  memberships: () => [...companyWorkspaceKeys.root, "memberships"] as const,
  offices: (companyId: string | null) => [...companyWorkspaceKeys.root, "offices", companyId] as const,
  addresses: (companyId: string | null, officeId: string | null) => [
    ...companyWorkspaceKeys.root,
    "addresses",
    companyId,
    officeId,
  ] as const,
  categories: (companyId: string | null) => [...companyWorkspaceKeys.root, "categories", companyId] as const,
  catalog: (companyId: string | null, officeId: string | null) => [
    ...companyWorkspaceKeys.root, "catalog", companyId, officeId,
  ] as const,
  templates: (companyId: string | null) => [
    ...companyWorkspaceKeys.root, "templates", companyId,
  ] as const,
  assets: (companyId: string | null, officeId: string | null) => [
    ...companyWorkspaceKeys.root, "assets", companyId, officeId,
  ] as const,
  requests: (companyId: string | null) => [
    ...companyWorkspaceKeys.root, "requests", companyId,
  ] as const,
  consultantRequests: (companyId: string | null) => [
    ...companyWorkspaceKeys.root, "consultant-requests", companyId,
  ] as const,
};

export interface UseCompanyWorkspaceOptions {
  selectedCompanyId?: string | null;
  selectedOfficeId?: string | null;
}

export function useCompanyWorkspace(options: UseCompanyWorkspaceOptions = {}) {
  const queryClient = useQueryClient();
  const selectedCompanyId = options.selectedCompanyId || null;
  const selectedOfficeId = options.selectedOfficeId || null;

  const capabilityQuery = useQuery({
    queryKey: companyWorkspaceKeys.capability(),
    queryFn: () => detectCompanyHubV2(repositoryClient),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const isV2Available = capabilityQuery.data?.status === "available";

  const membershipsQuery = useQuery({
    queryKey: companyWorkspaceKeys.memberships(),
    queryFn: () => listMyCompanyMemberships(repositoryClient),
    enabled: isV2Available,
  });

  const selectedMembership = membershipsQuery.data?.find(
    (membership) => membership.id === selectedCompanyId,
  ) || null;

  const scope: CompanyWorkspaceScope | null = selectedMembership
    ? { tenantId: selectedMembership.tenant_id, companyId: selectedMembership.id }
    : null;

  const officesQuery = useQuery({
    queryKey: companyWorkspaceKeys.offices(selectedCompanyId),
    queryFn: () => listCompanyOffices(repositoryClient, selectedCompanyId!),
    enabled: isV2Available && Boolean(selectedCompanyId),
  });

  const addressesQuery = useQuery({
    queryKey: companyWorkspaceKeys.addresses(selectedCompanyId, selectedOfficeId),
    queryFn: () => listCompanyAddresses(repositoryClient, selectedCompanyId!, {
      officeId: selectedOfficeId,
    }),
    enabled: isV2Available && Boolean(selectedCompanyId),
  });

  const categoriesQuery = useQuery({
    queryKey: companyWorkspaceKeys.categories(selectedCompanyId),
    queryFn: () => listCompanyCategories(repositoryClient, selectedCompanyId!),
    enabled: isV2Available && Boolean(selectedCompanyId),
  });

  const catalogQuery = useQuery({
    queryKey: companyWorkspaceKeys.catalog(selectedCompanyId, selectedOfficeId),
    queryFn: async () => {
      const [items, itemOfficeIds] = await Promise.all([
        listCompanyCatalogItems(repositoryClient, selectedCompanyId!),
        listCompanyCatalogItemOfficeIds(repositoryClient, selectedCompanyId!),
      ]);
      return items.filter((item) => {
        if ((item.office_scope || "all") === "all") return true;
        if (!selectedOfficeId) return false;
        return (itemOfficeIds[item.id] || []).includes(selectedOfficeId);
      });
    },
    enabled: isV2Available && Boolean(selectedCompanyId),
  });

  const templatesQuery = useQuery({
    queryKey: companyWorkspaceKeys.templates(selectedCompanyId),
    queryFn: () => listCompanyTemplateBindings(repositoryClient, selectedCompanyId!, { activeOnly: true }),
    enabled: isV2Available && Boolean(selectedCompanyId),
  });

  const assetsQuery = useQuery({
    queryKey: companyWorkspaceKeys.assets(selectedCompanyId, selectedOfficeId),
    queryFn: () => listCompanyAssets(repositoryClient, selectedCompanyId!, { officeId: selectedOfficeId }),
    enabled: isV2Available && Boolean(selectedCompanyId),
  });

  const orderRequestsQuery = useQuery({
    queryKey: companyWorkspaceKeys.requests(selectedCompanyId),
    queryFn: () => listCompanyOrderRequests(repositoryClient, selectedCompanyId!),
    enabled: isV2Available && Boolean(selectedCompanyId),
  });

  const consultantRequestsQuery = useQuery({
    queryKey: companyWorkspaceKeys.consultantRequests(selectedCompanyId),
    queryFn: () => listCompanyConsultantRequests(repositoryClient, selectedCompanyId!),
    enabled: isV2Available && Boolean(selectedCompanyId),
  });

  const requireScope = (): CompanyWorkspaceScope => {
    if (!scope) {
      throw new Error("Vælg et firma, før du ændrer arbejdsområdet.");
    }
    return scope;
  };

  const invalidateLocations = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: companyWorkspaceKeys.offices(selectedCompanyId) }),
      queryClient.invalidateQueries({
        queryKey: companyWorkspaceKeys.addresses(selectedCompanyId, selectedOfficeId),
      }),
    ]);
  };

  const createOfficeMutation = useMutation({
    mutationFn: (input: CreateCompanyOfficeInput) => (
      createCompanyOffice(repositoryClient, requireScope(), input)
    ),
    onSuccess: invalidateLocations,
  });

  const updateOfficeMutation = useMutation({
    mutationFn: ({ officeId, input }: { officeId: string; input: UpdateCompanyOfficeInput }) => (
      updateCompanyOffice(repositoryClient, requireScope(), officeId, input)
    ),
    onSuccess: invalidateLocations,
  });

  const archiveOfficeMutation = useMutation({
    mutationFn: (officeId: string) => archiveCompanyOffice(repositoryClient, requireScope(), officeId),
    onSuccess: invalidateLocations,
  });

  const createAddressMutation = useMutation({
    mutationFn: (input: CreateCompanyAddressInput) => (
      createCompanyAddress(repositoryClient, requireScope(), input)
    ),
    onSuccess: invalidateLocations,
  });

  const updateAddressMutation = useMutation({
    mutationFn: ({ addressId, input }: { addressId: string; input: UpdateCompanyAddressInput }) => (
      updateCompanyAddress(repositoryClient, requireScope(), addressId, input)
    ),
    onSuccess: invalidateLocations,
  });

  const archiveAddressMutation = useMutation({
    mutationFn: (addressId: string) => (
      archiveCompanyAddress(repositoryClient, requireScope(), addressId)
    ),
    onSuccess: invalidateLocations,
  });

  const createWorkingDesignMutation = useMutation({
    mutationFn: ({ bindingId, values }: { bindingId: string; values: Record<string, unknown> }) => (
      createCompanyWorkingDesign(supabase as any, requireScope(), bindingId, values)
    ),
  });

  const uploadAssetMutation = useMutation({
    mutationFn: (input: CompanyAssetUploadInput) => uploadCompanyAsset(supabase as any, requireScope(), input),
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: companyWorkspaceKeys.assets(selectedCompanyId, selectedOfficeId),
    }),
  });

  const archiveAssetMutation = useMutation({
    mutationFn: (assetId: string) => archiveCompanyAsset(repositoryClient, requireScope(), assetId),
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: companyWorkspaceKeys.assets(selectedCompanyId, selectedOfficeId),
    }),
  });

  const getAssetUrl = (asset: CompanyAsset) => createCompanyAssetSignedUrl(supabase as any, asset.storage_path);

  const decideOrderRequestMutation = useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) => (
      decideCompanyOrderRequest(supabase as any, requestId, approve)
    ),
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: companyWorkspaceKeys.requests(selectedCompanyId),
    }),
  });

  const createConsultantRequestMutation = useMutation({
    mutationFn: (input: CreateCompanyConsultantRequestInput) => (
      createCompanyConsultantRequest(supabase as any, requireScope(), {
        ...input,
        officeId: input.officeId ?? selectedOfficeId,
      })
    ),
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: companyWorkspaceKeys.consultantRequests(selectedCompanyId),
    }),
  });

  return {
    capabilityQuery,
    isV2Available,
    membershipsQuery,
    selectedMembership,
    officesQuery,
    addressesQuery,
    categoriesQuery,
    catalogQuery,
    templatesQuery,
    assetsQuery,
    orderRequestsQuery,
    consultantRequestsQuery,
    createOfficeMutation,
    updateOfficeMutation,
    archiveOfficeMutation,
    createAddressMutation,
    updateAddressMutation,
    archiveAddressMutation,
    createWorkingDesignMutation,
    uploadAssetMutation,
    archiveAssetMutation,
    getAssetUrl,
    decideOrderRequestMutation,
    createConsultantRequestMutation,
  };
}
