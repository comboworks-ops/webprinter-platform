type ActiveSiteCatalogContext = {
  activeSiteId?: unknown;
  hostname?: string | null;
  rootDomain?: string | null;
};

function normalizeHostname(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/:\d+$/, "");
}

export function resolveActiveSiteCatalogId({
  activeSiteId,
  hostname,
  rootDomain = "webprinter.dk",
}: ActiveSiteCatalogContext): string | null {
  const siteId = typeof activeSiteId === "string" ? activeSiteId.trim() : "";
  if (!siteId) return null;

  const host = normalizeHostname(hostname);
  const root = normalizeHostname(rootDomain).replace(/^www\./, "");
  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  const isPlatformRoot = Boolean(root) && (host === root || host === `www.${root}`);

  // The master storefront and localhost previews use the tenant's complete catalog.
  // An active site is a visual design choice there, not an implicit product scope.
  if (!host || isLocalhost || isPlatformRoot) return null;

  return siteId;
}
