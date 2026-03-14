import { supabase } from "@/integrations/supabase/client";

export interface CatalogReadRequest {
  hostname?: string | null;
  pathname?: string | null;
  tenantId?: string | null;
  tenant_id?: string | null;
  force_domain?: string | null;
  overview?: string | null;
  category?: string | null;
  subcategory?: string | null;
}

export interface CatalogReadResponse {
  success: boolean;
  source: string;
  request: {
    hostname: string | null;
    pathname: string | null;
    tenantId: string | null;
    forceDomain: string | null;
    overview: string | null;
    category: string | null;
    subcategory: string | null;
    rootDomain: string;
  };
  tenant: {
    id: string;
    name: string;
    domain: string | null;
    isMasterTenant: boolean;
  } | null;
  overviews: Array<{
    id: string;
    name: string;
    slug: string;
    sort_order?: number | null;
  }>;
  categories: Array<{
    id?: string;
    name: string;
    slug: string;
    sort_order?: number | null;
    overview_id?: string | null;
    parent_category_id?: string | null;
    navigation_mode?: "all_in_one" | "submenu" | null;
    frontend_product_id?: string | null;
  }>;
  filters: {
    matchedOverview: Record<string, unknown> | null;
    matchedCategory: Record<string, unknown> | null;
    matchedSubcategory: Record<string, unknown> | null;
  };
  products: Array<Record<string, unknown>>;
  filteredProducts: Array<Record<string, unknown>>;
  listingProducts: Array<Record<string, unknown>>;
  error?: string;
}

export async function fetchCatalogRead(input: CatalogReadRequest = {}): Promise<CatalogReadResponse> {
  const { data, error } = await supabase.functions.invoke("catalog-read", {
    body: {
      hostname: input.hostname || window.location.hostname,
      pathname: input.pathname || window.location.pathname,
      tenantId: input.tenantId || input.tenant_id || null,
      force_domain: input.force_domain || null,
      overview: input.overview || null,
      category: input.category || null,
      subcategory: input.subcategory || null,
    },
  });

  if (error) {
    throw error;
  }

  return data as CatalogReadResponse;
}
