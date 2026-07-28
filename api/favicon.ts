export const config = {
  runtime: "edge",
};

const DEFAULT_FAVICON_PATH = "/platform-favicon.png";

function normalizeHostname(value: string): string {
  return value
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

export function resolveFaviconAssetPath(hostname: string): string {
  const normalizedHost = normalizeHostname(hostname);

  if (normalizedHost === "onlinetryksager.dk") {
    return "/tenant-favicons/onlinetryksager.png";
  }

  if (normalizedHost === "salgsmapper.dk") {
    return "/tenant-favicons/salgsmapper.svg";
  }

  return DEFAULT_FAVICON_PATH;
}

function getRequestedHostname(request: Request): string {
  const url = new URL(request.url);
  return request.headers.get("x-forwarded-host")
    || request.headers.get("host")
    || url.hostname;
}

async function fetchFaviconAsset(request: Request, path: string): Promise<Response> {
  const assetUrl = new URL(path, request.url);
  return fetch(assetUrl, {
    headers: {
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: "GET, HEAD" },
    });
  }

  const requestedPath = resolveFaviconAssetPath(getRequestedHostname(request));
  let assetResponse = await fetchFaviconAsset(request, requestedPath);

  if (!assetResponse.ok && requestedPath !== DEFAULT_FAVICON_PATH) {
    assetResponse = await fetchFaviconAsset(request, DEFAULT_FAVICON_PATH);
  }

  if (!assetResponse.ok) {
    return new Response("Favicon unavailable", { status: 502 });
  }

  const headers = new Headers();
  headers.set("content-type", assetResponse.headers.get("content-type") || "image/png");
  headers.set("cache-control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000");
  headers.set("content-disposition", "inline");
  headers.set("x-content-type-options", "nosniff");

  return new Response(
    request.method === "HEAD" ? null : assetResponse.body,
    {
      status: 200,
      headers,
    },
  );
}
