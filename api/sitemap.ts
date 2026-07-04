import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_ROOT_DOMAIN,
  getDomainVariants,
  isPlatformRootHost,
  normalizeHostname,
  normalizeStorefrontPathname,
  normalizeStorefrontTenantSettings,
  shouldUseTenantStorefrontSeo,
  type StorefrontTenantRow,
} from "../src/lib/storefront/seo.js";
import { PLATFORM_PAGES } from "../src/lib/platform-seo/types.js";

export const config = {
  runtime: "edge",
};

const ROOT_DOMAIN = process.env.VITE_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY
  || "";

const TENANT_STATIC_PATHS = [
  "/",
  "/produkter",
  "/shop",
  "/prisberegner",
  "/om-os",
  "/kontakt",
  "/betingelser",
  "/grafisk-vejledning",
];

const EXCLUDED_PATH_PREFIXES = [
  "/admin",
  "/api",
  "/auth",
  "/min-konto",
  "/mine-ordrer",
  "/preview",
  "/preview-shop",
  "/profil",
];

type SitemapUrl = {
  loc: string;
  lastmod?: string | null;
};

function buildTenantClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getRequestedHost(request: Request): string {
  const url = new URL(request.url);
  const forcedDomain = url.searchParams.get("force_domain");
  if (forcedDomain) return normalizeHostname(forcedDomain);

  return normalizeHostname(
    request.headers.get("x-forwarded-host")
      || request.headers.get("host")
      || url.host,
  );
}

function getRequestedOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = getRequestedHost(request) || url.host;
  const protocol = forwardedProto ? `${forwardedProto}:` : url.protocol;
  return `${protocol}//${host}`.replace(/^http:\/\//, "https://");
}

function normalizeSitemapPath(path: string): string | null {
  const normalized = normalizeStorefrontPathname(path);
  if (!normalized || normalized === "/sitemap.xml") return null;
  if (EXCLUDED_PATH_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
    return null;
  }
  return normalized;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toSitemapXml(urls: SitemapUrl[]): string {
  const deduped = new Map<string, SitemapUrl>();
  urls.forEach((url) => {
    if (!deduped.has(url.loc)) deduped.set(url.loc, url);
  });

  const body = Array.from(deduped.values())
    .sort((a, b) => a.loc.localeCompare(b.loc))
    .map((url) => {
      const lastmod = url.lastmod ? `\n    <lastmod>${escapeXml(url.lastmod.slice(0, 10))}</lastmod>` : "";
      return `  <url>\n    <loc>${escapeXml(url.loc)}</loc>${lastmod}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function findTenantByDomain(domain: string | null | undefined): Promise<StorefrontTenantRow | null> {
  const client = buildTenantClient();
  const variants = getDomainVariants(domain);

  if (!client || !variants.length) return null;

  const { data } = await client
    .from("tenants")
    .select("id, name, domain, settings, is_platform_owned")
    .in("domain", variants)
    .limit(1)
    .maybeSingle();

  if (data) return data as StorefrontTenantRow;

  const normalized = variants[0].replace(/^www\./, "");
  if (normalized && normalized.endsWith(`.${ROOT_DOMAIN}`)) {
    const { data: subdomainMatch } = await client
      .from("tenants")
      .select("id, name, domain, settings, is_platform_owned")
      .eq("domain", normalized)
      .maybeSingle();

    return (subdomainMatch as StorefrontTenantRow | null) ?? null;
  }

  return null;
}

async function buildTenantUrls(origin: string, tenantId: string): Promise<SitemapUrl[]> {
  const client = buildTenantClient();
  const urls = new Map<string, SitemapUrl>();

  TENANT_STATIC_PATHS.forEach((path) => {
    urls.set(path, { loc: new URL(path, origin).toString() });
  });

  if (!client) return Array.from(urls.values());

  const [{ data: products }, { data: seoRows }] = await Promise.all([
    client
      .from("products")
      .select("slug, updated_at")
      .eq("tenant_id", tenantId),
    client
      .from("page_seo")
      .select("slug")
      .eq("tenant_id", tenantId),
  ]);

  (products || []).forEach((product: { slug?: string | null; updated_at?: string | null }) => {
    if (!product.slug) return;
    const path = normalizeSitemapPath(`/produkt/${product.slug}`);
    if (!path) return;
    urls.set(path, {
      loc: new URL(path, origin).toString(),
      lastmod: product.updated_at || null,
    });
  });

  (seoRows || []).forEach((row: { slug?: string | null }) => {
    if (!row.slug) return;
    const path = normalizeSitemapPath(row.slug);
    if (!path) return;
    urls.set(path, { loc: new URL(path, origin).toString() });
  });

  return Array.from(urls.values());
}

function buildPlatformUrls(origin: string): SitemapUrl[] {
  return PLATFORM_PAGES
    .map((page) => normalizeSitemapPath(page.path))
    .filter((path): path is string => Boolean(path))
    .map((path) => ({
      loc: new URL(path === "/" ? "/" : path, origin).toString(),
    }));
}

export default async function handler(request: Request): Promise<Response> {
  const hostname = getRequestedHost(request);
  const origin = getRequestedOrigin(request);

  let urls: SitemapUrl[] = buildPlatformUrls(origin);

  if (!isPlatformRootHost(hostname, ROOT_DOMAIN)) {
    const tenant = await findTenantByDomain(hostname);
    const settings = normalizeStorefrontTenantSettings(tenant);

    if (tenant?.id && shouldUseTenantStorefrontSeo({ settings, hostname, rootDomain: ROOT_DOMAIN })) {
      urls = await buildTenantUrls(origin, tenant.id);
    }
  }

  return new Response(toSitemapXml(urls), {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
