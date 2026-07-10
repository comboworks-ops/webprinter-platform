import type {
  ComputedPlatformSeo,
  PlatformSeoPage,
  PlatformSeoSettings,
} from "./types.js";

const DEFAULT_BASE_URL = "https://www.webprinter.dk";
const DEFAULT_PLATFORM_OG_IMAGE_PATH = "/platform-og-image.png";
const DEFAULT_PLATFORM_ICON_PATH = "/platform-favicon.svg";

export const PLATFORM_META_PATHS = new Set([
  "/",
  "/platform",
  "/priser",
  "/white-label",
  "/beregning",
  "/order-flow",
  "/online-designer",
  "/om-os",
  "/kontakt",
  "/privacy-policy",
  "/handelsbetingelser",
  "/cookiepolitik",
  "/opret-shop",
]);

type PlatformFallbackMeta = {
  pageTitle: string;
  title?: string;
  description: string;
};

const PLATFORM_FALLBACKS: Record<string, PlatformFallbackMeta> = {
  "/": {
    pageTitle: "Webprinter.dk",
    title: "Webprinter.dk | Web-to-print platform til trykkerier",
    description: "Start en professionel printshop med prisberegner, ordreflow, online designer og tenantstyring samlet i Webprinter.dk.",
  },
  "/platform": {
    pageTitle: "Web-to-print platform",
    title: "Web-to-print platform til trykkerier | Webprinter.dk",
    description: "Få webshop, produktkatalog, prisberegner, ordreflow og online designer i én samlet SaaS-platform til trykkerier.",
  },
  "/priser": {
    pageTitle: "Priser",
    title: "Priser på web-to-print løsning | Webprinter.dk",
    description: "Se planer og priser for Webprinter.dk, og vælg en løsning til printshop, ordreflow, online designer og beregning.",
  },
  "/white-label": {
    pageTitle: "White Label Webshop",
    title: "White label printshop med eget domæne | Webprinter.dk",
    description: "Byg en white-label webshop til tryksager med eget domæne, eget design, produktkatalog og professionelt ordreflow.",
  },
  "/beregning": {
    pageTitle: "Prisberegning",
    title: "Prisberegner til tryksager og print | Webprinter.dk",
    description: "Opsæt avanceret prisberegning til flyers, plakater, salgsmapper, storformat og specialtryk med matrix og regler.",
  },
  "/order-flow": {
    pageTitle: "Ordreflow",
    title: "Ordreflow til trykkerier og printshops | Webprinter.dk",
    description: "Saml ordre, upload, godkendelse, produktion og kundekommunikation i et effektivt ordreflow til printshops.",
  },
  "/online-designer": {
    pageTitle: "Online Designer",
    title: "Online designer til tryksager | Webprinter.dk",
    description: "Giv kunderne en online designer til tryksager med skabeloner, filupload, preflight, soft proof og PDF til print.",
  },
  "/om-os": {
    pageTitle: "Om Os",
    title: "Om Webprinter.dk | Platform til moderne trykkerier",
    description: "Læs om Webprinter.dk, vores erfaring med tryksager, web-to-print, prisberegning og drift af moderne printshops.",
  },
  "/kontakt": {
    pageTitle: "Kontakt",
    title: "Kontakt Webprinter.dk | Book demo af printshop platform",
    description: "Kontakt Webprinter.dk for demo, rådgivning eller spørgsmål om webshop, prisberegner, online designer og ordreflow.",
  },
  "/privacy-policy": {
    pageTitle: "Privatlivspolitik",
    title: "Privatlivspolitik | Webprinter.dk",
    description: "Læs hvordan Webprinter.dk behandler persondata, cookies og oplysninger fra brugere, kunder og printshops.",
  },
  "/handelsbetingelser": {
    pageTitle: "Handelsbetingelser",
    title: "Handelsbetingelser | Webprinter.dk",
    description: "Læs handelsbetingelser for brug af Webprinter.dk, herunder platform, abonnement, support og leverancevilkår.",
  },
  "/cookiepolitik": {
    pageTitle: "Cookiepolitik",
    title: "Cookiepolitik | Webprinter.dk",
    description: "Læs hvordan Webprinter.dk bruger cookies og lignende teknologier til drift, statistik og forbedring af platformen.",
  },
  "/opret-shop": {
    pageTitle: "Opret Shop",
    title: "Opret printshop online | Webprinter.dk",
    description: "Opret en professionel printshop med eget design, produkter, prisberegner, online designer og ordreflow.",
  },
};

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const [pathOnly] = pathname.split("?");
  const normalized = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function getFallback(pathname: string): PlatformFallbackMeta {
  return PLATFORM_FALLBACKS[normalizePathname(pathname)] || {
    pageTitle: "Webprinter.dk",
    title: "Webprinter.dk | Web-to-print platform til moderne trykkerier",
    description: "Webprinter.dk samler webshop, ordreflow, prisberegning og online designer i en samlet løsning til moderne trykkerier.",
  };
}

export function getDefaultPlatformPageTitle(pathname: string): string {
  return getFallback(pathname).pageTitle;
}

export function getDefaultPlatformPageDescription(pathname: string): string {
  return getFallback(pathname).description;
}

export function computePlatformSeo(
  settings: PlatformSeoSettings | null,
  pageOverride: PlatformSeoPage | null,
  pathname: string,
  hostname: string,
): ComputedPlatformSeo {
  const normalizedPath = normalizePathname(pathname);
  const fallback = getFallback(normalizedPath);
  const baseUrl = settings?.canonical_base_url || `https://${hostname}` || DEFAULT_BASE_URL;
  const canonicalUrl = pageOverride?.canonical_url || `${baseUrl}${normalizedPath === "/" ? "" : normalizedPath}`;
  const pageTitle = pageOverride?.title || fallback.pageTitle;
  const title = pageOverride?.title
    ? pageOverride.title
    : fallback.title
      || pageTitle;
  const description = pageOverride?.description || fallback.description || settings?.default_description || "Den komplette løsning til moderne trykkerier.";
  const robots = pageOverride?.robots || settings?.default_robots || "index,follow";
  const ogTitle = pageOverride?.og_title || title;
  const ogDescription = pageOverride?.og_description || description;
  const ogImageUrl = pageOverride?.og_image_url || settings?.default_og_image_url || `${baseUrl}${DEFAULT_PLATFORM_OG_IMAGE_PATH}`;
  const iconUrl = `${baseUrl}${DEFAULT_PLATFORM_ICON_PATH}`;

  const locales = settings?.locales || [{ locale: "da-DK", lang: "da", isDefault: true, pathPrefix: "" }];
  const hreflangTags = locales.map((loc) => ({
    lang: loc.locale,
    href: `${baseUrl}${loc.pathPrefix}${normalizedPath === "/" ? "" : normalizedPath}`,
  }));

  const defaultLocale = locales.find((loc) => loc.isDefault);
  if (defaultLocale) {
    hreflangTags.push({
      lang: "x-default",
      href: `${baseUrl}${defaultLocale.pathPrefix}${normalizedPath === "/" ? "" : normalizedPath}`,
    });
  }

  const jsonLd: Record<string, unknown>[] = [];
  if (settings?.organization_jsonld) jsonLd.push(settings.organization_jsonld);
  if (settings?.website_jsonld) jsonLd.push(settings.website_jsonld);
  if (pageOverride?.jsonld) jsonLd.push(pageOverride.jsonld);

  return {
    title,
    description,
    robots,
    canonicalUrl,
    ogTitle,
    ogDescription,
    ogImageUrl,
    iconUrl,
    ogUrl: canonicalUrl,
    ogSiteName: "Webprinter.dk",
    hreflangTags,
    jsonLd,
  };
}
