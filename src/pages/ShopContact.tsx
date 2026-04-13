import { ContactContent } from "@/components/content/ContactContent";
import { StorefrontContentPage } from "@/components/storefront/StorefrontContentPage";

const ShopContact = () => {
  return (
    <StorefrontContentPage mainClassName="flex-1 py-16">
        <ContactContent />
    </StorefrontContentPage>
  );
};

export default ShopContact;
