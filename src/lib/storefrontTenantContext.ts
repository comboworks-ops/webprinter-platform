const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1"]);
const PRESERVED_QUERY_KEYS = ["tenantId", "tenant_id", "force_domain", "tenant_subdomain"] as const;

const isExternalHref = (href: string): boolean =>
  /^(?:[a-z]+:)?\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");

export const appendStorefrontTenantContext = (href: string): string => {
  if (!href || typeof window === "undefined") return href;
  if (href.startsWith("#") || isExternalHref(href)) return href;
  try {
    const currentUrl = new URL(window.location.href);
    // Explicit storefront previews are supported on production hosts too. Do not
    // infer a tenant into ordinary custom-domain links that have no URL selector.
    const hasCurrentContext = PRESERVED_QUERY_KEYS.some((key) => currentUrl.searchParams.has(key));
    if (!hasCurrentContext && !LOCALHOST_NAMES.has(currentUrl.hostname)) return href;
    const targetUrl = new URL(href, currentUrl.origin);

    if (targetUrl.origin !== currentUrl.origin) {
      return href;
    }

    // A link selecting another shop owns its complete context. Mixing aliases
    // from the current URL could override it or create a conflicting tenant pair.
    if (PRESERVED_QUERY_KEYS.some((key) => targetUrl.searchParams.has(key))) return href;

    PRESERVED_QUERY_KEYS.forEach((key) => {
      const value = currentUrl.searchParams.get(key);
      if (value && !targetUrl.searchParams.has(key)) {
        targetUrl.searchParams.set(key, value);
      }
    });

    return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  } catch {
    return href;
  }
};
