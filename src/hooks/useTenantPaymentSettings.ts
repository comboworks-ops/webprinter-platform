import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant } from "@/lib/adminTenant";

export interface TenantPaymentSettings {
  tenant_id: string;
  provider: string;
  stripe_account_id: string | null;
  status: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  country: string | null;
  currency: string | null;
  platform_fee_percent: number | null;
  platform_fee_flat_ore: number | null;
  updated_at: string;
  created_at: string;
}

export function useTenantPaymentSettings() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    resolveAdminTenant().then(({ tenantId: resolvedTenantId }) => {
      if (active) setTenantId(resolvedTenantId);
    });
    return () => {
      active = false;
    };
  }, []);

  const query = useQuery({
    queryKey: ["tenant-payment-settings", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tenant_payment_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data as TenantPaymentSettings | null) ?? null;
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<TenantPaymentSettings> & { tenant_id: string }) => {
      const { data, error } = await (supabase as any)
        .from("tenant_payment_settings")
        .upsert(payload, { onConflict: "tenant_id" })
        .select("*")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as TenantPaymentSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-payment-settings", tenantId] });
    },
  });

  return {
    tenantId,
    ...query,
    upsert,
  };
}
