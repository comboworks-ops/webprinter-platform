import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import { useShopSettings } from "@/hooks/useShopSettings";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_ROOT_DOMAIN,
  resolveStorefrontSeoMeta,
  shouldUseTenantStorefrontSeo,
  buildAiFaqSchema,
  normalizeStorefrontPathname,
  type StorefrontSettings,
} from "@/lib/storefront/seo";

const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN;

export function StorefrontSeo() {
  const { data } = useShopSettings();
  const settings = (data || {}) as StorefrontSettings;
  const location = useLocation();
  const { isPreviewMode, previewPath } = usePreviewBranding();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const pathname = normalizeStorefrontPathname(isPreviewMode && previewPath ? previewPath : location.pathname);
  const shouldApply = shouldUseTenantStorefrontSeo({ settings, hostname, rootDomain: ROOT_DOMAIN });

  const { data: pageSeoOverride, isLoading: pageSeoLoading } = useQuery({
    queryKey: ["storefront-page-seo", settings.id, pathname],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from("page_seo" as any)
        .select("title, meta_description, og_image_url")
        .eq("tenant_id", settings.id)
        .eq("slug", pathname)
        .maybeSingle();

      if (error) {
        console.warn("[StorefrontSeo] Could not load tenant page_seo row", {
          tenantId: settings.id,
          pathname,
          error,
        });
        return null;
      }

      return row as {
        title?: string | null;
        meta_description?: string | null;
        og_image_url?: string | null;
      } | null;
    },
    enabled: shouldApply && Boolean(settings.id) && !isPreviewMode,
    staleTime: 5 * 60 * 1000,
  });

  if (!shouldApply) {
    return null;
  }

  if (pageSeoLoading && !isPreviewMode) {
    return null;
  }

  if (!isPreviewMode && !pageSeoOverride) {
    return null;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const baseMeta = resolveStorefrontSeoMeta({
    pathname,
    origin,
    settings,
  });
  const meta = {
    ...baseMeta,
    ...(pageSeoOverride?.title ? { title: pageSeoOverride.title } : {}),
    ...(pageSeoOverride?.meta_description ? { description: pageSeoOverride.meta_description } : {}),
    ...(pageSeoOverride?.og_image_url ? { imageUrl: pageSeoOverride.og_image_url } : {}),
  };

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
