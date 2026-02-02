import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ContactContent } from "@/components/content/ContactContent";

const ShopContact = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-16">
        <ContactContent />
      </main>
      <Footer />
    </div>
  );
};

export default ShopContact;
