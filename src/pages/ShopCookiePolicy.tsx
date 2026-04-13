import { CookiePolicyContent } from "@/components/content/CookiePolicyContent";
import { StorefrontContentPage } from "@/components/storefront/StorefrontContentPage";

const ShopCookiePolicy = () => {
  return (
    <StorefrontContentPage mainClassName="flex-1 py-16 pt-24">
      <CookiePolicyContent />
    </StorefrontContentPage>
  );
};

export default ShopCookiePolicy;
