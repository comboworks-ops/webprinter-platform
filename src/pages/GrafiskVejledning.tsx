import { SEO } from "@/components/SEO";
import { GrafiskVejledningContent } from "@/components/content/GrafiskVejledningContent";
import { StorefrontContentPage } from "@/components/storefront/StorefrontContentPage";
import { useShopSettings } from "@/hooks/useShopSettings";

const GrafiskVejledning = () => {
  const { data: settings } = useShopSettings();
  const shopName = settings?.branding?.shop_name || settings?.tenant_name || "Webprinter";

  return (
    <StorefrontContentPage
      mainClassName="flex-1 py-12"
      topSlot={(
        <SEO
          title={`Grafisk Vejledning | ${shopName}`}
          description="Krav til trykfiler: bleed, PDF, opløsning, CMYK/RGB, spotlak, folie, konturskæring og storformat."
        />
      )}
    >
      <GrafiskVejledningContent />
    </StorefrontContentPage>
  );
};

export default GrafiskVejledning;
