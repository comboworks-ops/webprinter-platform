import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ContactContent } from "@/components/content/ContactContent";
import { useShopSettings } from "@/hooks/useShopSettings";
import { getPageBackgroundStyle } from "@/lib/branding/background";

const ShopContact = () => {
  const { data: settings } = useShopSettings();
  const pageBackgroundStyle = getPageBackgroundStyle(settings?.branding);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-16" style={pageBackgroundStyle}>
        <ContactContent />
      </main>
      <Footer />
    </div>
  );
};

export default ShopContact;
