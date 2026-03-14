import { supabase } from "@/integrations/supabase/client";

export type TenantContextMode = "storefront" | "admin";

export interface TenantContextRequest {
  mode?: TenantContextMode;
  hostname?: string | null;
  pathname?: string | null;
  tenantId?: string | null;
  tenant_id?: string | null;
  force_domain?: string | null;
}

export interface TenantContextResponse {
  success: boolean;
  mode: TenantContextMode;
  source: string;
  request: {
    hostname: string | null;
    pathname: string | null;
    tenantId: string | null;
    forceDomain: string | null;
    rootDomain: string;
    isLocalhost: boolean;
    isPlatformRoot: boolean;
  };
  tenant: {
    id: string;
    name: string;
    domain: string | null;
    isMasterTenant: boolean;
    activeSiteId: string | null;
  } | null;
  auth: {
    isAuthenticated: boolean;
    userId: string | null;
    email: string | null;
    role: string | null;
    isMasterAdmin: boolean;
    hasTenantAccess: boolean;
  };
  error?: string;
}

export async function fetchTenantContext(input: TenantContextRequest = {}): Promise<TenantContextResponse> {
  const { data, error } = await supabase.functions.invoke("tenant-context-read", {
    body: {
      mode: input.mode || "storefront",
      hostname: input.hostname || window.location.hostname,
      pathname: input.pathname || window.location.pathname,
      tenantId: input.tenantId || input.tenant_id || null,
      force_domain: input.force_domain || null,
    },
  });

  if (error) {
    throw error;
  }

  return data as TenantContextResponse;
}
