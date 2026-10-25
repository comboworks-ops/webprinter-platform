const PVCBANNER_TENANT = 'cd3c7d7b-2220-46b8-93cf-096de23e93d8';
export function isPvcbannerJourney(hostname: string, pathname: string, search: string, tenantId?: string | null): boolean {
  if (/^\/(admin|preview-shop|preview-storefront)(\/|$)/.test(pathname)) return false;
  const host = hostname.toLowerCase();
  if (host === 'pvcbanner.dk' || host === 'www.pvcbanner.dk') return true;
  if (host === 'localhost' || host === '127.0.0.1') {
    return new URLSearchParams(search).get('force_domain') === 'pvcbanner.dk' || tenantId === PVCBANNER_TENANT;
  }
  return tenantId === PVCBANNER_TENANT;
}

/** Preview identity comes from the selected tenant, never its display name. */
export function isPvcbannerFrame(hostname: string, pathname: string, search: string, tenantId: string | null | undefined, preview: boolean): boolean {
  if (preview) {
    const params = new URLSearchParams(search);
    return (params.get('tenantId') || params.get('tenant_id')) === PVCBANNER_TENANT;
  }
  return isPvcbannerJourney(hostname, pathname, search, tenantId);
}
