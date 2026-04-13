import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import { useShopSettings } from "@/hooks/useShopSettings";
import {
  DEFAULT_ROOT_DOMAIN,
  resolveStorefrontSeoMeta,
  shouldUseTenantStorefrontSeo,
  buildAiFaqSchema,
  type StorefrontSettings,
} from "@/lib/storefront/seo";

const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN;

export function StorefrontSeo() {
  const { data } = useShopSettings();
  const settings = (data || {}) as StorefrontSettings;
  const location = useLocation();
  const { isPreviewMode, previewPath } = usePreviewBranding();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const pathname = isPreviewMode && previewPath ? previewPath : location.pathname;

  if (!shouldUseTenantStorefrontSeo({ settings, hostname, rootDomain: ROOT_DOMAIN })) {
    return null;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const meta = resolveStorefrontSeoMeta({
    pathname,
    origin,
    settings,
  });

  const aiSeo = (settings as Record<string, unknown>)?.ai_seo as Record<string, unknown> | undefined;
  const faqSchema = aiSeo ? buildAiFaqSchema(aiSeo) : null;

  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <meta name="author" content={meta.author} />
      <link rel="canonical" href={meta.canonicalUrl} />
      <link rel="icon" href={meta.iconUrl} />

      <meta property="og:type" content="website" />
      <meta property="og:url" content={meta.ogUrl} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:image" content={meta.imageUrl} />
      <meta property="og:site_name" content={meta.siteName} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={meta.ogUrl} />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={meta.imageUrl} />

      {/* Primary structured data (PrintingService + AI-enhanced) */}
      <script type="application/ld+json">{meta.structuredData}</script>

      {/* FAQ schema for AI answer engines */}
      {faqSchema && (
        <script type="application/ld+json">{faqSchema}</script>
      )}
    </Helmet>
  );
}

export default StorefrontSeo;
