function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clampText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

function getInitials(shopName: string): string {
  const parts = shopName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  return shopName.replace(/[^a-z0-9æøå]/gi, "").slice(0, 2).toUpperCase() || "WP";
}

function buildIconSvg(input: {
  shopName: string;
  accent: string;
  text: string;
  bg: string;
}): string {
  const initials = escapeXml(getInitials(input.shopName));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="${escapeXml(input.shopName)}">
  <rect width="512" height="512" rx="128" fill="${escapeXml(input.bg)}" />
  <rect x="52" y="52" width="408" height="408" rx="108" fill="${escapeXml(input.accent)}" fill-opacity="0.12" stroke="${escapeXml(input.accent)}" stroke-width="18" />
  <text x="256" y="294" text-anchor="middle" font-size="168" font-weight="700" font-family="Inter, Arial, sans-serif" fill="${escapeXml(input.text)}">${initials}</text>
</svg>`;
}

function buildOgSvg(input: {
  shopName: string;
  accent: string;
  text: string;
  bg: string;
}): string {
  const initials = escapeXml(getInitials(input.shopName));
  const label = escapeXml(clampText(input.shopName, 30));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${label}">
  <rect width="1200" height="630" fill="${escapeXml(input.bg)}" />
  <circle cx="1030" cy="110" r="180" fill="${escapeXml(input.accent)}" fill-opacity="0.14" />
  <circle cx="180" cy="520" r="220" fill="${escapeXml(input.accent)}" fill-opacity="0.08" />
  <rect x="88" y="88" width="1024" height="454" rx="48" fill="${escapeXml(input.bg)}" stroke="${escapeXml(input.accent)}" stroke-opacity="0.22" stroke-width="6" />
  <rect x="138" y="150" width="170" height="170" rx="42" fill="${escapeXml(input.accent)}" fill-opacity="0.12" stroke="${escapeXml(input.accent)}" stroke-width="5" />
  <text x="223" y="255" text-anchor="middle" font-size="84" font-weight="700" font-family="Inter, Arial, sans-serif" fill="${escapeXml(input.text)}">${initials}</text>
  <text x="366" y="228" font-size="72" font-weight="700" font-family="Poppins, Inter, Arial, sans-serif" fill="${escapeXml(input.text)}">${label}</text>
  <text x="366" y="294" font-size="30" font-weight="500" font-family="Inter, Arial, sans-serif" fill="${escapeXml(input.text)}" opacity="0.82">Professionelle tryksager online</text>
  <rect x="366" y="334" width="154" height="8" rx="4" fill="${escapeXml(input.accent)}" />
  <text x="138" y="438" font-size="28" font-weight="500" font-family="Inter, Arial, sans-serif" fill="${escapeXml(input.text)}" opacity="0.72">Brandmark genereret automatisk fra tenantens branding</text>
</svg>`;
}

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const variant = url.searchParams.get("variant") === "icon" ? "icon" : "og";
  const shopName = clampText(url.searchParams.get("shop") || "Webprinter", variant === "icon" ? 12 : 30);
  const accent = url.searchParams.get("accent") || "#0EA5E9";
  const text = url.searchParams.get("text") || "#111827";
  const bg = url.searchParams.get("bg") || "#FFFFFF";
  const svg = variant === "icon"
    ? buildIconSvg({ shopName, accent, text, bg })
    : buildOgSvg({ shopName, accent, text, bg });

  return new Response(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
