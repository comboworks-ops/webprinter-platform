import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CompanyAccount, CompanyMember, HubItem } from "@/components/companyhub/types";
import { toast } from "sonner";

export function useCompanyHub(tenantId?: string) {
    const queryClient = useQueryClient();

    // --- Company Accounts ---
    const companiesQuery = useQuery({
        queryKey: ["company_accounts", tenantId],
        queryFn: async () => {
            if (!tenantId) return [];
            const { data, error } = await supabase
                .from("company_accounts" as any)
                .select("*")
                .eq("tenant_id", tenantId)
                .order("name");
            if (error) throw error;
            return data as unknown as CompanyAccount[];
        },
        enabled: !!tenantId,
    });

    const createCompanyMutation = useMutation({
        mutationFn: async (payload: Partial<CompanyAccount>) => {
            if (!tenantId) throw new Error("Tenant ID mangler");
            const { data, error } = await supabase
                .from("company_accounts" as any)
                .insert([{ ...payload, tenant_id: tenantId }])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["company_accounts"] });
            toast.success("Firma oprettet");
        },
    });

    const updateCompanyMutation = useMutation({
        mutationFn: async (payload: Partial<CompanyAccount>) => {
            const { id, ...updateData } = payload;
            const { data, error } = await supabase
                .from("company_accounts" as any)
                .update(updateData)
                .eq("id", id);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["company_accounts"] });
            toast.success("Firma opdateret");
        },
    });

    const deleteCompanyMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("company_accounts" as any)
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["company_accounts"] });
            toast.success("Firma slettet");
        },
    });

    const hubItemsQuery = (companyId?: string) => useQuery({
        queryKey: ["company_hub_items", companyId],
        queryFn: async () => {
            if (!companyId) return [];
            const { data, error } = await supabase
                .from("company_hub_items" as any)
                .select(`
                    *,
                    product:products(name)
                `)
                .eq("company_id", companyId)
                .order("sort_order");
            if (error) throw error;
            return (data as any[]).map(item => ({
                ...item,
                product_name: item.product?.name
            })) as (HubItem & { product_name: string })[];
        },
        enabled: !!companyId,
    });

    const createHubItemMutation = useMutation({
        mutationFn: async (payload: Partial<HubItem>) => {
            if (!tenantId) throw new Error("Tenant ID mangler");
            const { data, error } = await supabase
                .from("company_hub_items" as any)
                .insert([{ ...payload, tenant_id: tenantId }])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["company_hub_items", variables.company_id] });
            toast.success("Hub item oprettet");
        },
    });

    const updateHubItemMutation = useMutation({
        mutationFn: async (payload: Partial<HubItem>) => {
            const { id, product, product_name, ...updateData } = payload as any;
            const { data, error } = await supabase
                .from("company_hub_items" as any)
                .update(updateData)
                .eq("id", id);
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["company_hub_items", (variables as any).company_id] });
            toast.success("Hub item opdateret");
        },
    });

    const deleteHubItemMutation = useMutation({
        mutationFn: async ({ id, companyId }: { id: string, companyId: string }) => {
            const { error } = await supabase
                .from("company_hub_items" as any)
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["company_hub_items", variables.companyId] });
            toast.success("Hub item slettet");
        },
    });

    const membersQuery = (companyId?: string) => useQuery({
        queryKey: ["company_members", companyId],
        queryFn: async () => {
            if (!companyId) return [];
            const { data, error } = await supabase
                .from("company_members" as any)
                .select(`
                    *,
                    profile:profiles(first_name, last_name, email)
                `)
                .eq("company_id", companyId);
            if (error) throw error;
            return data.map((m: any) => ({
                ...m,
                user_name: m.profile ? (`${m.profile.first_name || ''} ${m.profile.last_name || ''}`.trim() || m.profile.email || "Navn mangler") : "Profil ikke fundet",
                user_email: m.profile?.email
            })) as (CompanyMember & { user_name: string, user_email?: string })[];
        },
        enabled: !!companyId,
    });

    const addMemberMutation = useMutation({
        mutationFn: async (payload: Partial<CompanyMember>) => {
            if (!tenantId) throw new Error("Tenant ID mangler");
            const { data, error } = await supabase
                .from("company_members" as any)
                .insert([{ ...payload, tenant_id: tenantId }])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["company_members", variables.company_id] });
            toast.success("Medlem tilføjet");
        },
    });

    const removeMemberMutation = useMutation({
        mutationFn: async ({ company_id, user_id }: { company_id: string, user_id: string }) => {
            const { error } = await supabase
                .from("company_members" as any)
                .delete()
                .eq("company_id", company_id)
                .eq("user_id", user_id);
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["company_members", variables.company_id] });
            toast.success("Medlem fjernet");
        },
    });

    const myMembershipsQuery = useQuery({
        queryKey: ["my_company_memberships"],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];
            const { data, error } = await supabase
                .from("company_members" as any)
                .select("company:company_accounts(*)")
                .eq("user_id", user.id);
            if (error) throw error;
            return (data as any[]).map((d: any) => d.company) as CompanyAccount[];
        }
    });

    const tenantUsersQuery = useQuery({
        queryKey: ["tenant_users", tenantId],
        queryFn: async () => {
            if (!tenantId) return [];
            // Try roles first
            const { data: roleUsers } = await supabase
                .from("user_roles" as any)
                .select(`
                    user_id,
                    profile:profiles(first_name, last_name, email)
                `)
                .eq("tenant_id", tenantId);

            let users = (roleUsers as any[] || []).map(d => ({
                id: d.user_id,
                name: d.profile ? (`${d.profile.first_name || ''} ${d.profile.last_name || ''}`.trim() || d.profile.email || d.user_id) : d.user_id,
                email: d.profile?.email
            }));

            if (users.length === 0) {
                const { data: profiles } = await supabase
                    .from("profiles" as any)
                    .select("id, first_name, last_name, email")
                    .limit(50);
                users = (profiles || []).map((p: any) => ({
                    id: p.id,
                    name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || p.id,
                    email: p.email
                }));
            }
            return users;
        },
        enabled: !!tenantId,
    });

    return {
        companiesQuery,
        createCompanyMutation,
        updateCompanyMutation,
        deleteCompanyMutation,
        hubItemsQuery,
        createHubItemMutation,
        updateHubItemMutation,
        deleteHubItemMutation,
        membersQuery,
        addMemberMutation,
        removeMemberMutation,
        myMembershipsQuery,
        tenantUsersQuery
    };
}
