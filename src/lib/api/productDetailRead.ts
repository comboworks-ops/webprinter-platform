import { supabase } from "@/integrations/supabase/client";

export interface ProductDetailReadRequest {
  hostname?: string | null;
  pathname?: string | null;
  tenantId?: string | null;
  tenant_id?: string | null;
  force_domain?: string | null;
  slug?: string | null;
  productId?: string | null;
  product_id?: string | null;
}

export interface ProductDetailReadResponse {
  success: boolean;
  source: string;
  request: {
    hostname: string | null;
    pathname: string | null;
    tenantId: string | null;
    forceDomain: string | null;
    slug: string | null;
    productId: string | null;
    rootDomain: string;
  };
  tenant: {
    id: string;
    name: string;
    domain: string | null;
    isMasterTenant: boolean;
  } | null;
  product: Record<string, unknown> | null;
  optionGroups: Array<{
    id: string;
    name: string;
    label: string;
    display_type: string;
    description: string | null;
    options: Array<{
      id: string;
      group_id: string;
      name: string;
      label: string;
      description: string | null;
      icon_url: string | null;
      extra_price: number;
      price_mode: string;
      sort_order: number | null;
    }>;
  }>;
  customFields: Array<{
    id: string;
    field_name: string;
    field_label: string;
    field_type: string;
    default_value: unknown;
    is_required: boolean;
    product_id: string;
  }>;
  error?: string;
}

export async function fetchProductDetailRead(input: ProductDetailReadRequest): Promise<ProductDetailReadResponse> {
  const { data, error } = await supabase.functions.invoke("product-detail-read", {
    body: {
      hostname: input.hostname || window.location.hostname,
      pathname: input.pathname || window.location.pathname,
      tenantId: input.tenantId || input.tenant_id || null,
      force_domain: input.force_domain || null,
      slug: input.slug || null,
      productId: input.productId || input.product_id || null,
    },
  });

  if (error) {
    throw error;
  }

  return data as ProductDetailReadResponse;
}
