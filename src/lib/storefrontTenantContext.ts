const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1"]);
const PRESERVED_QUERY_KEYS = ["tenantId", "tenant_id", "force_domain", "tenant_subdomain"] as const;

const isExternalHref = (href: string): boolean =>
  /^(?:[a-z]+:)?\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");

export const appendStorefrontTenantContext = (href: string): string => {
  if (!href || typeof window === "undefined") return href;
  if (href.startsWith("#") || isExternalHref(href)) return href;
  if (!LOCALHOST_NAMES.has(window.location.hostname)) return href;

  try {
    const currentUrl = new URL(window.location.href);
    const targetUrl = new URL(href, currentUrl.origin);

    if (targetUrl.origin !== currentUrl.origin) {
      return href;
    }

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
