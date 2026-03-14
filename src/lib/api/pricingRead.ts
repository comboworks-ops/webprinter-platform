import { supabase } from "@/integrations/supabase/client";

export interface PricingReadRequest {
  hostname?: string | null;
  pathname?: string | null;
  tenantId?: string | null;
  tenant_id?: string | null;
  force_domain?: string | null;
  slug?: string | null;
  productId?: string | null;
  product_id?: string | null;
  formatId?: string | null;
  materialId?: string | null;
  verticalValueId?: string | null;
  variantKey?: string | null;
  quantity?: number | null;
  variantValueIds?: string[] | null;
  variantDisplayLabels?: string[] | null;
  selectedSectionValues?: Record<string, string | null> | null;
}

export interface PricingReadResponse {
  success: boolean;
  source: string;
  request: {
    hostname: string | null;
    pathname: string | null;
    tenantId: string | null;
    forceDomain: string | null;
    slug: string | null;
    productId: string | null;
    formatId: string | null;
    materialId: string | null;
    verticalValueId?: string | null;
    variantKey?: string | null;
    quantity: number | null;
    variantValueIds: string[];
    variantDisplayLabels?: string[];
    selectedSectionValues?: Record<string, string | null>;
    rootDomain: string;
  };
  tenant: {
    id: string;
    name: string;
    domain: string | null;
    isMasterTenant: boolean;
  } | null;
  product: {
    id: string;
    tenant_id: string;
    name: string;
    slug: string;
    pricing_type: string | null;
    pricing_structure: unknown;
  } | null;
  summary: {
    totalRows: number;
    matchedRows: number;
    availableQuantities: number[];
  };
  bestMatch: Record<string, unknown> | null;
  matchedRows: Array<Record<string, unknown>>;
  error?: string;
}

export async function fetchPricingRead(input: PricingReadRequest): Promise<PricingReadResponse> {
  const { data, error } = await supabase.functions.invoke("pricing-read", {
    body: {
      hostname: input.hostname || window.location.hostname,
      pathname: input.pathname || window.location.pathname,
      tenantId: input.tenantId || input.tenant_id || null,
      force_domain: input.force_domain || null,
      slug: input.slug || null,
      productId: input.productId || input.product_id || null,
      formatId: input.formatId || null,
      materialId: input.materialId || null,
      verticalValueId: input.verticalValueId || null,
      variantKey: input.variantKey || null,
      quantity: input.quantity || null,
      variantValueIds: input.variantValueIds || [],
      variantDisplayLabels: input.variantDisplayLabels || [],
      selectedSectionValues: input.selectedSectionValues || {},
    },
  });

  if (error) {
    throw error;
  }

  return data as PricingReadResponse;
}
