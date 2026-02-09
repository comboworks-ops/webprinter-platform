import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AboutContent } from "@/components/content/AboutContent";
import { useShopSettings } from "@/hooks/useShopSettings";
import { getPageBackgroundStyle } from "@/lib/branding/background";

const About = () => {
  const { data: settings } = useShopSettings();
  const pageBackgroundStyle = getPageBackgroundStyle(settings?.branding);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1" style={pageBackgroundStyle}>
        <AboutContent />
      </main>

      <Footer />
    </div>
  );
};

export default About;
