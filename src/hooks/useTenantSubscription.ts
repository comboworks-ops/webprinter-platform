import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant } from "@/lib/adminTenant";

export type TenantSubscriptionPlan = "free" | "starter" | "professional" | "enterprise";
export type TenantSubscriptionCycle = "monthly" | "yearly";

export interface TenantSubscription {
  tenant_id: string;
  provider: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan_id: TenantSubscriptionPlan;
  billing_cycle: TenantSubscriptionCycle;
  status: string;
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  last_invoice_id: string | null;
  last_invoice_status: string | null;
  metadata: Record<string, unknown>;
  updated_at: string;
  created_at: string;
}

function getDefaultSubscription(tenantId: string): TenantSubscription {
  const now = new Date().toISOString();
  return {
    tenant_id: tenantId,
    provider: "stripe",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    plan_id: "free",
    billing_cycle: "monthly",
    status: "inactive",
    cancel_at_period_end: false,
    current_period_start: null,
    current_period_end: null,
    trial_end: null,
    last_invoice_id: null,
    last_invoice_status: null,
    metadata: {},
    updated_at: now,
    created_at: now,
  };
}

export function useTenantSubscription() {
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
    queryKey: ["tenant-subscription", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tenant_subscriptions")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) throw error;
      return (data as TenantSubscription | null) ?? getDefaultSubscription(tenantId!);
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<TenantSubscription> & { tenant_id: string }) => {
      const { data, error } = await (supabase as any)
        .from("tenant_subscriptions")
        .upsert(payload, { onConflict: "tenant_id" })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as TenantSubscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-subscription", tenantId] });
    },
  });

  return {
    tenantId,
    ...query,
    upsert,
  };
}

