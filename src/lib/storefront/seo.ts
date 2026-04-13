export const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
export const DEFAULT_ROOT_DOMAIN = "webprinter.dk";

export type StorefrontSettings = Record<string, unknown> & {
  id?: string;
  tenant_name?: string;
  domain?: string;
  branding?: {
    logo_url?: string;
    favicon?: {
      type?: "preset" | "custom";
      presetId?: string;
      presetColor?: string;
      customUrl?: string | null;
    };
    colors?: {
      primary?: string;
      secondary?: string;
      background?: string;
      headingText?: string;
      bodyText?: string;
    };
    header?: {
      logoText?: string;
      logoImageUrl?: string;
      bgColor?: string;
      textColor?: string;
      logoTextColor?: string;
    };
  };
  company?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    zip?: string;
    city?: string;
    country?: string;
  };
};

export type StorefrontTenantRow = {
  id?: string;
  name?: string | null;
  domain?: string | null;
  settings?: Record<string, unknown> | null;
  is_platform_owned?: boolean | null;
};

export type StorefrontSeoMeta = {
  title: string;
  description: string;
  canonicalUrl: string;
  ogUrl: string;
  imageUrl: string;
  iconUrl: string;
  siteName: string;
  author: string;
  structuredData: string;
};

type BrandmarkVariant = "icon" | "og";

export type StorefrontAiSeoFaqItem = {
  id?: string;
  question: string;
  answer: string;
};

export type StorefrontAiSeoConfig = {
  enabled: boolean;
  elevatorPitch: string;
  aboutParagraph: string;
  services: string[];
  usps: string[];
  faq: StorefrontAiSeoFaqItem[];
  signals: {
    faqSchema: boolean;
    enhancedOrg: boolean;
    speakable: boolean;
  };
};

export const DEFAULT_STOREFRONT_AI_SEO_CONFIG: StorefrontAiSeoConfig = {
  enabled: true,
  elevatorPitch: "",
  aboutParagraph: "",
  services: [],
  usps: [],
  faq: [],
  signals: {
    faqSchema: true,
    enhancedOrg: true,
    speakable: true,
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function normalizeFaqItems(input: unknown): StorefrontAiSeoFaqItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => {
      const record = (item || {}) as Record<string, unknown>;
      return {
        id: String(record.id || `faq-${index}`),
        question: String(record.question || ""),
        answer: String(record.answer || ""),
      };
    })
    .filter((item) => item.question.trim() || item.answer.trim());
}

export function normalizeStorefrontAiSeoConfig(input: unknown): StorefrontAiSeoConfig {
  const record = (input || {}) as Record<string, unknown>;
  const rawSignals = (record.signals || {}) as Record<string, unknown>;

  return {
    enabled: record.enabled !== false,
    elevatorPitch: String(record.elevatorPitch || ""),
    aboutParagraph: String(record.aboutParagraph || ""),
    services: safeStringArray(record.services),
    usps: safeStringArray(record.usps),
    faq: normalizeFaqItems(record.faq),
    signals: {
      faqSchema: rawSignals.faqSchema !== false,
      enhancedOrg: rawSignals.enhancedOrg !== false,
      speakable: rawSignals.speakable !== false,
    },
  };
}

export function generateStorefrontLlmsTxt(
  config: StorefrontAiSeoConfig,
  shopName: string,
  domain: string,
  company: Record<string, string | undefined>,
): string {
  const lines: string[] = [];

  lines.push(`# ${shopName}`);
  lines.push("");

  if (config.elevatorPitch) {
    lines.push(`> ${config.elevatorPitch}`);
    lines.push("");
  }

  if (config.aboutParagraph) {
    lines.push(config.aboutParagraph);
    lines.push("");
  }

  if (config.services.length > 0) {
    lines.push("## Services");
    config.services.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }

  if (config.usps.length > 0) {
    lines.push("## Fordele");
    config.usps.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }

  const faq = config.faq.filter((item) => item.question.trim() && item.answer.trim());
  if (faq.length > 0) {
    lines.push("## Frequently Asked Questions");
    lines.push("");
    faq.forEach((item) => {
      lines.push(`Q: ${item.question}`);
      lines.push(`A: ${item.answer}`);
      lines.push("");
    });
  }

  const contactLines: string[] = [];
  if (company?.email) contactLines.push(`- Email: ${company.email}`);
  if (company?.phone) contactLines.push(`- Telefon: ${company.phone}`);
  if (company?.address) {
    const address = [company.address, company.zip, company.city].filter(Boolean).join(", ");
    contactLines.push(`- Adresse: ${address}`);
  }
  if (domain) contactLines.push(`- Hjemmeside: https://${domain}`);

  if (contactLines.length > 0) {
    lines.push("## Kontakt");
    lines.push(...contactLines);
  }

  return lines.join("\n");
}

function upsertTag(
  html: string,
  pattern: RegExp,
  replacement: string,
  fallback: string,
): string {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }

  if (html.includes("</head>")) {
    return html.replace("</head>", `  ${fallback}\n</head>`);
  }

  return `${html}\n${fallback}`;
}

function upsertTitle(html: string, title: string): string {
  const escaped = escapeHtml(title);
  return upsertTag(
    html,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escaped}</title>`,
    `<title>${escaped}</title>`,
  );
}

function upsertNamedMeta(html: string, name: string, content: string): string {
  const escapedName = escapeRegExp(name);
  const escapedContent = escapeHtml(content);
  const tag = `<meta name="${name}" content="${escapedContent}" />`;
  return upsertTag(
    html,
    new RegExp(`<meta[^>]+name=["']${escapedName}["'][^>]*>`, "i"),
    tag,
    tag,
  );
}

function upsertPropertyMeta(html: string, property: string, content: string): string {
  const escapedProperty = escapeRegExp(property);
  const escapedContent = escapeHtml(content);
  const tag = `<meta property="${property}" content="${escapedContent}" />`;
  return upsertTag(
    html,
    new RegExp(`<meta[^>]+property=["']${escapedProperty}["'][^>]*>`, "i"),
    tag,
    tag,
  );
}

function upsertLink(html: string, rel: string, href: string): string {
  const escapedRel = escapeRegExp(rel);
  const escapedHref = escapeHtml(href);
  const tag = `<link rel="${rel}" href="${escapedHref}" />`;
  return upsertTag(
    html,
    new RegExp(`<link[^>]+rel=["']${escapedRel}["'][^>]*>`, "i"),
    tag,
    tag,
  );
}

function upsertJsonLd(html: string, payload: string): string {
  const safePayload = payload.replace(/<\/script>/gi, "<\\/script>");
  const tag = `<script type="application/ld+json">${safePayload}</script>`;
  return upsertTag(
    html,
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i,
    tag,
    tag,
  );
}

export function normalizeHostname(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

export function getDomainVariants(value: string | null | undefined): string[] {
  const normalized = normalizeHostname(value);
  if (!normalized) return [];

  const withoutWww = normalized.replace(/^www\./, "");
  return Array.from(new Set([
    normalized,
    withoutWww,
    `www.${withoutWww}`,
  ]));
}

export function isLocalhostHost(hostname: string | null | undefined): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost" || normalized === "127.0.0.1";
}

export function isPlatformRootHost(
  hostname: string | null | undefined,
  rootDomain: string = DEFAULT_ROOT_DOMAIN,
): boolean {
  const normalizedHost = normalizeHostname(hostname);
  const normalizedRoot = normalizeHostname(rootDomain) || DEFAULT_ROOT_DOMAIN;
  return normalizedHost === normalizedRoot || normalizedHost === `www.${normalizedRoot}`;
}

export function normalizeStorefrontPathname(pathname: string | null | undefined): string {
  const raw = String(pathname || "").trim();
  if (!raw || raw === "/") return "/";

  const [pathOnly] = raw.split("?");
  const normalized = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

export function extractPublishedBranding(settings: Record<string, unknown> | null | undefined): unknown {
  const branding = (settings?.branding as Record<string, unknown> | undefined) || undefined;
  if (!branding) return undefined;

  if (branding.published || branding.draft) {
    return branding.published || branding.draft;
  }

  if (branding.logo_url || branding.colors || branding.fonts || branding.hero || branding.header) {
    return branding;
  }

  return undefined;
}

export function normalizeStorefrontTenantSettings(tenant: StorefrontTenantRow | null | undefined): StorefrontSettings {
  const settings = (tenant?.settings || {}) as Record<string, unknown>;
  return {
    ...settings,
    branding: extractPublishedBranding(settings) as StorefrontSettings["branding"],
    _rawBranding: settings.branding,
    tenant_name: tenant?.name || undefined,
    id: tenant?.id || undefined,
    domain: tenant?.domain || undefined,
    is_platform_owned: tenant?.is_platform_owned ?? false,
  };
}

export function resolveStorefrontShopName(settings: StorefrontSettings): string {
  const header = settings?.branding?.header || {};
  const company = settings?.company || {};
  const domain = String(settings?.domain || "").replace(/^www\./, "");

  return String(
    header.logoText
      || company.name
      || settings?.tenant_name
      || domain
      || "Webprinter",
  ).trim();
}

export function resolveStorefrontTitle(pathname: string, shopName: string): string {
  const normalized = normalizeStorefrontPathname(pathname);
  switch (normalized) {
    case "/":
    case "/shop":
    case "/produkter":
    case "/prisberegner":
      return shopName;
    case "/kontakt":
      return `Kontakt | ${shopName}`;
    case "/om-os":
      return `Om os | ${shopName}`;
    case "/vilkaar":
    case "/betingelser":
      return `Handelsbetingelser | ${shopName}`;
    case "/privatliv":
      return `Privatlivspolitik | ${shopName}`;
    default: {
      // Product pages: /produkt/visitkort → "Visitkort | ShopName"
      const productMatch = normalized.match(/^\/produkt\/([^/]+)$/);
      if (productMatch) {
        const slug = productMatch[1];
        const productName = slug
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return `${productName} | ${shopName}`;
      }
      return `${shopName} | Webshop`;
    }
  }
}

export function resolveStorefrontDescription(pathname: string, shopName: string): string {
  const normalized = normalizeStorefrontPathname(pathname);
  switch (normalized) {
    case "/kontakt":
      return `Kontakt ${shopName} for tilbud, support og rådgivning om tryksager.`;
    case "/om-os":
      return `Læs mere om ${shopName} og vores trykløsninger.`;
    case "/vilkaar":
    case "/betingelser":
      return `Handelsbetingelser for ${shopName}.`;
    case "/privatliv":
      return `Privatlivspolitik for ${shopName}.`;
    case "/shop":
    case "/produkter":
    case "/prisberegner":
      return `Se produkter og beregn priser hos ${shopName}.`;
    case "/":
    default: {
      // Product pages: /produkt/visitkort → sensible fallback description
      const productMatch = normalized.match(/^\/produkt\/([^/]+)$/);
      if (productMatch) {
        const slug = productMatch[1];
        const productName = slug
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return `Bestil ${productName} online hos ${shopName}. Professionel kvalitet til konkurrencedygtige priser.`;
      }
      return `${shopName} tilbyder professionelle tryksager og printløsninger online.`;
    }
  }
}

function resolveAbsoluteUrl(origin: string, value: string): string {
  if (!value) return origin;
  if (/^https?:\/\//i.test(value)) return value;
  const normalized = value.startsWith("/") ? value : `/${value}`;
  return `${origin}${normalized}`;
}

function buildGeneratedBrandmarkUrl(input: {
  origin: string;
  shopName: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  variant: BrandmarkVariant;
}): string {
  const params = new URLSearchParams({
    variant: input.variant,
    shop: input.shopName,
    accent: input.accentColor,
    text: input.textColor,
    bg: input.backgroundColor,
  });

  return `${input.origin}/api/storefront-brandmark?${params.toString()}`;
}

function buildStructuredData(
  settings: StorefrontSettings,
  shopName: string,
  canonicalUrl: string,
): string {
  const company = settings?.company || {};
  const aiSeo = normalizeStorefrontAiSeoConfig((settings as Record<string, unknown>)?.ai_seo);

  const payload: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "PrintingService",
    name: shopName,
    url: canonicalUrl,
    dateModified: new Date().toISOString().split("T")[0],
  };

  if (company.phone) {
    payload.telephone = company.phone;
  }

  if (company.email) {
    payload.email = company.email;
  }

  const address: Record<string, string> = {};
  if (company.address) address.streetAddress = company.address;
  if (company.zip) address.postalCode = company.zip;
  if (company.city) address.addressLocality = company.city;
  if (company.country) address.addressCountry = company.country;

  if (Object.keys(address).length > 0) {
    payload.address = {
      "@type": "PostalAddress",
      ...address,
    };
  }

  // AI SEO enhancements
  if (aiSeo.enabled && aiSeo.signals.enhancedOrg) {
    if (aiSeo.elevatorPitch) {
      payload.slogan = aiSeo.elevatorPitch;
    }
    if (aiSeo.aboutParagraph) {
      payload.description = aiSeo.aboutParagraph;
    }
    const services = aiSeo.services.filter((service) => service.trim());
    if (services && services.length > 0) {
      payload.hasOfferCatalog = {
        "@type": "OfferCatalog",
        name: `${shopName} Ydelser`,
        itemListElement: services.map((svc: string) => ({
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: svc,
          },
        })),
      };
    }
    const usps = aiSeo.usps.filter((usp) => usp.trim());
    if (usps && usps.length > 0) {
      payload.additionalProperty = usps.map((usp: string) => ({
        "@type": "PropertyValue",
        name: "Fordel",
        value: usp,
      }));
    }
  }

  if (aiSeo.enabled && aiSeo.signals.speakable) {
    payload.speakable = {
      "@type": "SpeakableSpecification",
      cssSelector: [
        "main [data-branding-id='forside.hero.title']",
        "main [data-branding-id='forside.hero.subtitle']",
        "main [data-branding-id='typography.heading']",
        "main h1",
        "main h2",
      ],
    };
  }

  return JSON.stringify(payload);
}

export function buildAiFaqSchema(aiSeo: Record<string, unknown>): string | null {
  const normalized = normalizeStorefrontAiSeoConfig(aiSeo);
  if (!normalized.enabled || !normalized.signals.faqSchema) return null;

  const faq = normalized.faq.filter((item) => item.question.trim() && item.answer.trim());

  if (!faq || faq.length === 0) return null;

  const payload = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return JSON.stringify(payload);
}

export function resolveStorefrontSeoMeta(input: {
  pathname: string;
  origin: string;
  settings: StorefrontSettings;
}): StorefrontSeoMeta {
  const normalizedPath = normalizeStorefrontPathname(input.pathname);
  const shopName = resolveStorefrontShopName(input.settings);
  const title = resolveStorefrontTitle(normalizedPath, shopName);
  const description = resolveStorefrontDescription(normalizedPath, shopName);
  const branding = input.settings?.branding || {};
  const colors = branding.colors || {};
  const header = branding.header || {};
  const favicon = branding.favicon || {};
  const brandAccent = String(
    colors.primary
      || header.bgColor
      || favicon.presetColor
      || "#0EA5E9",
  ).trim();
  const brandTextColor = String(
    header.logoTextColor
      || header.textColor
      || colors.headingText
      || colors.bodyText
      || "#111827",
  ).trim();
  const brandBackground = String(
    colors.background
      || header.bgColor
      || "#FFFFFF",
  ).trim();
  const uploadedLogo = String(
    branding.logo_url
      || header.logoImageUrl
      || "",
  ).trim();
  const customFavicon = String(favicon.customUrl || "").trim();
  const canonicalUrl = new URL(normalizedPath, input.origin).toString();
  const generatedOgImage = buildGeneratedBrandmarkUrl({
    origin: input.origin,
    shopName,
    accentColor: brandAccent,
    textColor: brandTextColor,
    backgroundColor: brandBackground,
    variant: "og",
  });
  const generatedIcon = buildGeneratedBrandmarkUrl({
    origin: input.origin,
    shopName,
    accentColor: brandAccent,
    textColor: brandTextColor,
    backgroundColor: brandBackground,
    variant: "icon",
  });
  const resolvedVisual = uploadedLogo
    ? resolveAbsoluteUrl(input.origin, uploadedLogo)
    : generatedOgImage;
  const resolvedIcon = customFavicon
    ? resolveAbsoluteUrl(input.origin, customFavicon)
    : uploadedLogo
      ? resolveAbsoluteUrl(input.origin, uploadedLogo)
      : generatedIcon;

  return {
    title,
    description,
    canonicalUrl,
    ogUrl: canonicalUrl,
    imageUrl: resolvedVisual,
    iconUrl: resolvedIcon,
    siteName: shopName,
    author: shopName,
    structuredData: buildStructuredData(input.settings, shopName, canonicalUrl),
  };
}

export function shouldUseTenantStorefrontSeo(input: {
  settings: StorefrontSettings | null | undefined;
  hostname: string | null | undefined;
  rootDomain?: string;
}): boolean {
  const settings = input.settings;
  if (!settings?.id || settings.id === MASTER_TENANT_ID) {
    return false;
  }

  return !isPlatformRootHost(input.hostname, input.rootDomain || DEFAULT_ROOT_DOMAIN);
}

export function injectStorefrontSeoIntoHtml(html: string, meta: StorefrontSeoMeta): string {
  let nextHtml = html;

  nextHtml = upsertTitle(nextHtml, meta.title);
  nextHtml = upsertNamedMeta(nextHtml, "description", meta.description);
  nextHtml = upsertNamedMeta(nextHtml, "author", meta.author);
  nextHtml = upsertLink(nextHtml, "canonical", meta.canonicalUrl);
  nextHtml = upsertLink(nextHtml, "icon", meta.iconUrl);

  nextHtml = upsertPropertyMeta(nextHtml, "og:type", "website");
  nextHtml = upsertPropertyMeta(nextHtml, "og:url", meta.ogUrl);
  nextHtml = upsertPropertyMeta(nextHtml, "og:title", meta.title);
  nextHtml = upsertPropertyMeta(nextHtml, "og:description", meta.description);
  nextHtml = upsertPropertyMeta(nextHtml, "og:image", meta.imageUrl);
  nextHtml = upsertPropertyMeta(nextHtml, "og:site_name", meta.siteName);

  nextHtml = upsertNamedMeta(nextHtml, "twitter:card", "summary_large_image");
  nextHtml = upsertNamedMeta(nextHtml, "twitter:url", meta.ogUrl);
  nextHtml = upsertNamedMeta(nextHtml, "twitter:title", meta.title);
  nextHtml = upsertNamedMeta(nextHtml, "twitter:description", meta.description);
  nextHtml = upsertNamedMeta(nextHtml, "twitter:image", meta.imageUrl);

  nextHtml = upsertJsonLd(nextHtml, meta.structuredData);

  return nextHtml;
}
