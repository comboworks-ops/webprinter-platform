import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_ROOT_DOMAIN,
  getDomainVariants,
  injectStorefrontSeoIntoHtml,
  isLocalhostHost,
  isPlatformRootHost,
  normalizeHostname,
  normalizeStorefrontPathname,
  normalizeStorefrontTenantSettings,
  resolveStorefrontSeoMeta,
  shouldUseTenantStorefrontSeo,
  type StorefrontSeoMeta,
  type StorefrontTenantRow,
} from "../src/lib/storefront/seo.js";
import { computePlatformSeo } from "../src/lib/platform-seo/metadata.js";

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
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  || "";

async function fetchSpaShell(request: Request): Promise<Response> {
  const shellUrl = new URL("/index.html", request.url);
  return fetch(shellUrl.toString(), {
    headers: {
      "x-tenant-shell": "1",
    },
    cache: "no-store",
  });
}

function withHtmlHeaders(source: Response, html: string): Response {
  const headers = new Headers(source.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  return new Response(html, {
    status: source.status,
    statusText: source.statusText,
    headers,
  });
}

function getRequestedPathname(request: Request): string {
  const url = new URL(request.url);
  const pathname = url.searchParams.get("pathname") || url.pathname;
  return normalizeStorefrontPathname(pathname);
}

function getRequestedHost(request: Request): string {
  const url = new URL(request.url);
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
  return `${protocol}//${host}`;
}

function buildTenantClient() {
  const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !key) {
    return null;
  }

  return createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function findTenantByDomain(domain: string | null | undefined): Promise<StorefrontTenantRow | null> {
  const client = buildTenantClient();
  const variants = getDomainVariants(domain);

  if (!client || !variants.length) {
    return null;
  }

  const { data } = await client
    .from("tenants")
    .select("id, name, domain, settings, is_platform_owned")
    .in("domain", variants)
    .limit(1)
    .maybeSingle();

  if (data) {
    return data as StorefrontTenantRow;
  }

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

interface PageSeoOverride {
  title?: string | null;
  meta_description?: string | null;
  og_image_url?: string | null;
}

async function getPageSeoOverride(tenantId: string, pathname: string): Promise<PageSeoOverride | null> {
  const client = buildTenantClient();
  if (!client || !tenantId || !pathname) return null;

  const { data } = await client
    .from("page_seo")
    .select("title, meta_description, og_image_url")
    .eq("tenant_id", tenantId)
    .eq("slug", pathname)
    .maybeSingle();

  return (data as PageSeoOverride | null) ?? null;
}

async function getPlatformSeoForPath(pathname: string) {
  const client = buildTenantClient();
  if (!client) {
    return { settings: null, pageOverride: null };
  }

  const [{ data: settings }, { data: pageOverride }] = await Promise.all([
    client
      .from("platform_seo_settings")
      .select("*")
      .limit(1)
      .maybeSingle(),
    client
      .from("platform_seo_pages")
      .select("*")
      .eq("path", pathname)
      .is("locale", null)
      .maybeSingle(),
  ]);

  return {
    settings: settings || null,
    pageOverride: pageOverride || null,
  };
}

function toHtmlMeta(input: {
  title: string;
  description: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string | null;
  ogUrl: string;
  siteName: string;
  author: string;
  jsonLd: Record<string, unknown>[];
}): StorefrontSeoMeta {
  return {
    title: input.title,
    description: input.description,
    canonicalUrl: input.canonicalUrl,
    ogUrl: input.ogUrl,
    imageUrl: input.ogImageUrl || `${new URL(input.canonicalUrl).origin}/platform-og-image.png`,
    iconUrl: `${new URL(input.canonicalUrl).origin}/platform-favicon.svg`,
    siteName: input.siteName,
    author: input.author,
    structuredData: JSON.stringify(input.jsonLd[0] || {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Webprinter.dk",
      url: new URL(input.canonicalUrl).origin,
    }),
  };
}

export default async function handler(request: Request): Promise<Response> {
  const shellResponse = await fetchSpaShell(request);
  const html = await shellResponse.text();
  const pathname = getRequestedPathname(request);
  const hostname = getRequestedHost(request);
  const origin = getRequestedOrigin(request);

  if (!html || isLocalhostHost(hostname)) {
    return withHtmlHeaders(shellResponse, html);
  }

  if (isPlatformRootHost(hostname, ROOT_DOMAIN)) {
    const { settings, pageOverride } = await getPlatformSeoForPath(pathname);
    const platformSeo = computePlatformSeo(settings, pageOverride, pathname, hostname);
    const meta = toHtmlMeta({
      title: platformSeo.title,
      description: platformSeo.description,
      canonicalUrl: platformSeo.canonicalUrl,
      ogTitle: platformSeo.ogTitle,
      ogDescription: platformSeo.ogDescription,
      ogImageUrl: platformSeo.ogImageUrl,
      ogUrl: platformSeo.ogUrl,
      siteName: platformSeo.ogSiteName,
      author: "Webprinter.dk",
      jsonLd: platformSeo.jsonLd,
    });

    return withHtmlHeaders(shellResponse, injectStorefrontSeoIntoHtml(html, meta));
  }

  const tenant = await findTenantByDomain(hostname);
  const settings = normalizeStorefrontTenantSettings(tenant);

  if (!shouldUseTenantStorefrontSeo({ settings, hostname, rootDomain: ROOT_DOMAIN })) {
    return withHtmlHeaders(shellResponse, html);
  }

  const [baseMeta, pageSeoOverride] = await Promise.all([
    Promise.resolve(resolveStorefrontSeoMeta({ pathname, origin, settings })),
    tenant?.id ? getPageSeoOverride(tenant.id, pathname) : Promise.resolve(null),
  ]);

  // Apply admin-configured page_seo overrides if present
  const meta: StorefrontSeoMeta = {
    ...baseMeta,
    ...(pageSeoOverride?.title && { title: pageSeoOverride.title }),
    ...(pageSeoOverride?.meta_description && { description: pageSeoOverride.meta_description }),
    ...(pageSeoOverride?.og_image_url && { imageUrl: pageSeoOverride.og_image_url }),
  };

  const injectedHtml = injectStorefrontSeoIntoHtml(html, meta);
  return withHtmlHeaders(shellResponse, injectedHtml);
}
