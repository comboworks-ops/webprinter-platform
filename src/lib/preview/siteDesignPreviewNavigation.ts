const PREVIEW_CONTEXT_QUERY_KEYS = new Set([
  "draft",
  "editor",
  "force_domain",
  "preview_mode",
  "sitePreview",
  "site_id",
  "siteId",
  "tenant_id",
  "tenantId",
]);

const PREVIEW_URL_BASE = "https://preview.webprinter.local";

export const SITE_DESIGN_PREVIEW_EXIT_LINK_PROPS = {
  "data-preview-exit": "true",
  target: "_top",
} as const;

export function normalizeSiteDesignPreviewPath(rawPath?: unknown): string {
  const value = String(rawPath || "").trim();
  if (!value) return "/";

  try {
    const url = new URL(value, PREVIEW_URL_BASE);
    PREVIEW_CONTEXT_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
    const query = url.searchParams.toString();
    return `${url.pathname || "/"}${query ? `?${query}` : ""}`;
  } catch {
    return value.startsWith("/") ? value.split("#")[0] || "/" : "/";
  }
}

export function getSiteDesignPreviewPathname(rawPath?: unknown): string {
  const normalized = normalizeSiteDesignPreviewPath(rawPath);
  return normalized.split(/[?#]/, 1)[0] || "/";
}

export function getSiteDesignPreviewProductSlug(rawPath?: unknown): string | null {
  const pathname = getSiteDesignPreviewPathname(rawPath);
  const match = /^\/produkt\/([^/]+)$/.exec(pathname);
  if (!match) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
