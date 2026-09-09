const SHOP_KEYS = ['tenantId', 'tenant_id', 'force_domain', 'tenant_subdomain'] as const;
const localSearch = () => typeof window === 'undefined' ? '' : window.location.search;

/** Only same-origin application paths may be used as an auth return target. */
export function safeCustomerReturnTarget(input: string | null | undefined): string {
  if (!input || !input.startsWith('/') || input.startsWith('//')) return '/min-konto';
  try {
    const decoded = decodeURIComponent(input);
    if (decoded.includes('\\') || [...decoded].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || decoded.startsWith('//')) return '/min-konto';
    const url = new URL(input, 'https://account.invalid');
    if (url.origin !== 'https://account.invalid' || url.pathname === '/auth') return '/min-konto';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return '/min-konto'; }
}

export function customerLink(href: string, search = localSearch()): string {
  const url = new URL(safeCustomerReturnTarget(href), 'https://account.invalid');
  const current = new URLSearchParams(search);
  if (SHOP_KEYS.some(key => current.has(key))) {
    SHOP_KEYS.forEach(key => url.searchParams.delete(key));
    SHOP_KEYS.forEach(key => { const value = current.get(key); if (value) url.searchParams.set(key, value); });
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function customerAuthHref(returnTo = '/min-konto', search = localSearch(), mode?: string): string {
  const params = new URLSearchParams();
  const current = new URLSearchParams(search);
  SHOP_KEYS.forEach(key => { const value = current.get(key); if (value) params.set(key, value); });
  params.set('redirect', customerLink(returnTo, search));
  if (mode === 'reset') params.set('mode', mode);
  return `/auth?${params.toString()}`;
}
