const TENANT_QUERY_KEYS = ["force_domain", "tenantId", "tenant_id"] as const;

function normalizeSearch(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

export function withCompanyTenantContext(path: string, search?: string): string {
  const currentSearch = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const params = normalizeSearch(currentSearch);
  params.delete("view");
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

export function buildCompanyAuthUrl(search?: string): string {
  const currentSearch = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const companyParams = normalizeSearch(currentSearch);
  const companyQuery = companyParams.toString();
  const authParams = new URLSearchParams({
    redirect: `/company${companyQuery ? `?${companyQuery}` : ""}`,
  });

  for (const key of TENANT_QUERY_KEYS) {
    const value = companyParams.get(key);
    if (value) authParams.set(key, value);
  }

  return `/auth?${authParams.toString()}`;
}
