import { DEFAULT_ROOT_DOMAIN, normalizeHostname } from "../src/lib/storefront/seo.js";

export const config = {
  runtime: "edge",
};

const ROOT_DOMAIN = process.env.VITE_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN;

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
  return `${protocol}//${host}`;
}

export default async function handler(request: Request): Promise<Response> {
  const origin = getRequestedOrigin(request).replace(/^http:\/\//, "https://");
  const sitemapUrl = `${origin}/sitemap.xml`;

  const body = `# ${ROOT_DOMAIN} robots.txt
User-agent: *
Allow: /

Disallow: /admin/
Disallow: /api/
Disallow: /preview/
Disallow: /preview-shop/

Sitemap: ${sitemapUrl}
`;

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
