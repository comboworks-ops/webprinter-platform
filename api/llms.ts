import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_ROOT_DOMAIN,
  generateStorefrontLlmsTxt,
  getDomainVariants,
  isPlatformRootHost,
  normalizeHostname,
  normalizeStorefrontAiSeoConfig,
  normalizeStorefrontTenantSettings,
  resolveStorefrontShopName,
  shouldUseTenantStorefrontSeo,
  type StorefrontTenantRow,
} from "../src/lib/storefront/seo.js";

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

function buildTenantClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

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
  if (forcedDomain) {
    return normalizeHostname(forcedDomain);
  }
  return normalizeHostname(
    request.headers.get("x-forwarded-host")
    || request.headers.get("host")
    || url.host,
  );
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

export default async function handler(request: Request): Promise<Response> {
  const hostname = getRequestedHost(request);

  if (isPlatformRootHost(hostname, ROOT_DOMAIN)) {
    return new Response("# llms.txt is only available on tenant storefront domains.\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  }

  const tenant = await findTenantByDomain(hostname);
  const settings = normalizeStorefrontTenantSettings(tenant);

  if (!shouldUseTenantStorefrontSeo({ settings, hostname, rootDomain: ROOT_DOMAIN })) {
    return new Response("# llms.txt is not enabled for this storefront.\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  }

  const aiSeo = normalizeStorefrontAiSeoConfig((settings as Record<string, unknown>)?.ai_seo);
  if (!aiSeo.enabled) {
    return new Response("# llms.txt is not enabled for this storefront.\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  }

  const body = generateStorefrontLlmsTxt(
    aiSeo,
    resolveStorefrontShopName(settings),
    String(settings.domain || ""),
    (settings.company || {}) as Record<string, string | undefined>,
  );

  return new Response(`${body}\n`, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
