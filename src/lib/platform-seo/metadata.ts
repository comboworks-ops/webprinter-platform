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
    title: "Webprinter.dk | Web-to-print platform til moderne trykkerier",
    description: "Webprinter.dk samler webshop, ordreflow, prisberegning og online designer i en samlet løsning til moderne trykkerier.",
  },
  "/platform": {
    pageTitle: "Webprinter.dk",
    title: "Platform | Webprinter.dk",
    description: "Se hvordan Webprinter.dk samler webshop, ordreflow, prisberegning og online designer i en samlet platform til moderne trykkerier.",
  },
  "/priser": {
    pageTitle: "Priser",
    title: "Priser | Webprinter.dk",
    description: "Se priser og planer for Webprinter.dk, og find den løsning der passer til dit trykkeri eller din printforretning.",
  },
  "/white-label": {
    pageTitle: "White Label Webshop",
    title: "White Label Webshop | Webprinter.dk",
    description: "Byg din egen white-label webshop til tryksager med dit domæne, dit design og dit eget kundeunivers.",
  },
  "/beregning": {
    pageTitle: "Prisberegning",
    title: "Prisberegning | Webprinter.dk",
    description: "Få avanceret prisberegning til tryksager med matrix-priser, volumenlogik og maskinbaserede beregninger.",
  },
  "/order-flow": {
    pageTitle: "Ordreflow",
    title: "Ordreflow | Webprinter.dk",
    description: "Strømlin ordrebehandlingen fra bestilling til levering med et operationelt ordreflow bygget til trykkerier.",
  },
  "/online-designer": {
    pageTitle: "Online Designer",
    title: "Online Designer | Webprinter.dk",
    description: "Giv kunderne en professionel online designer med soft proof, preflight og PDF-eksport klar til print.",
  },
  "/om-os": {
    pageTitle: "Om Os",
    title: "Om os | Webprinter.dk",
    description: "Læs mere om Webprinter.dk og teamet bag platformen for moderne trykkerier.",
  },
  "/kontakt": {
    pageTitle: "Kontakt",
    title: "Kontakt | Webprinter.dk",
    description: "Kontakt Webprinter.dk for demo, support eller spørgsmål om platformen og vores løsninger til trykkerier.",
  },
  "/privacy-policy": {
    pageTitle: "Privatlivspolitik",
    title: "Privatlivspolitik | Webprinter.dk",
    description: "Læs hvordan Webprinter.dk behandler persondata og beskytter oplysninger om brugere og kunder.",
  },
  "/handelsbetingelser": {
    pageTitle: "Handelsbetingelser",
    title: "Handelsbetingelser | Webprinter.dk",
    description: "Læs vilkårene for trykkerier og andre erhvervskunder, der bruger eller bestiller gennem Webprinter.dk.",
  },
  "/cookiepolitik": {
    pageTitle: "Cookiepolitik",
    title: "Cookiepolitik | Webprinter.dk",
    description: "Læs hvordan Webprinter.dk bruger cookies og lignende teknologier på platformen.",
  },
  "/opret-shop": {
    pageTitle: "Opret Shop",
    title: "Opret Shop | Webprinter.dk",
    description: "Start din egen printshop med Webprinter.dk og kom hurtigt i gang med webshop, designer og ordreflow.",
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
