import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { useShopSettings } from "@/hooks/useShopSettings";
import { getPageBackgroundStyle } from "@/lib/branding/background";
import { GrafiskVejledningContent } from "@/components/content/GrafiskVejledningContent";

const GrafiskVejledning = () => {
    const { data: settings } = useShopSettings();

    const shopName = settings?.branding?.shop_name || settings?.tenant_name || "Webprinter";
    const pageBackgroundStyle = getPageBackgroundStyle(settings?.branding);

    return (
        <div className="min-h-screen flex flex-col">
            <SEO
                title={`Grafisk Vejledning | ${shopName}`}
                description="Krav til trykfiler: bleed, PDF, opløsning, CMYK/RGB, spotlak, folie, konturskæring og storformat."
            />
            <Header />

            <main className="flex-1 py-12" style={pageBackgroundStyle}>
                <GrafiskVejledningContent />
            </main>

            <Footer />
        </div>
    );
};

export default GrafiskVejledning;
