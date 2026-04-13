import { useEffect } from "react";

import { useShopSettings } from "@/hooks/useShopSettings";
import {
  DEFAULT_ROOT_DOMAIN,
  generateStorefrontLlmsTxt,
  normalizeStorefrontAiSeoConfig,
  resolveStorefrontShopName,
  shouldUseTenantStorefrontSeo,
  type StorefrontSettings,
} from "@/lib/storefront/seo";

const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN;

export default function LlmsTxt() {
  const { data, isLoading } = useShopSettings();
  const settings = (data || {}) as StorefrontSettings;
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const aiSeo = normalizeStorefrontAiSeoConfig((settings as Record<string, unknown>)?.ai_seo);

  useEffect(() => {
    document.title = "llms.txt";
  }, []);

  if (isLoading) {
    return <pre className="p-6 font-mono text-sm">Generating llms.txt...</pre>;
  }

  const shouldServeTenantFile = shouldUseTenantStorefrontSeo({
    settings,
    hostname,
    rootDomain: ROOT_DOMAIN,
  });

  const content = shouldServeTenantFile && aiSeo.enabled
    ? generateStorefrontLlmsTxt(
      aiSeo,
      resolveStorefrontShopName(settings),
      String(settings.domain || ""),
      (settings.company || {}) as Record<string, string | undefined>,
    )
    : "# llms.txt is not enabled for this storefront.";

  return (
    <pre className="min-h-screen whitespace-pre-wrap bg-white p-6 font-mono text-sm text-slate-900">
      {content}
    </pre>
  );
}
