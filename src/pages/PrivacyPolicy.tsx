import { PrivacyPolicyContent } from "@/components/content/PrivacyPolicyContent";
import { StorefrontContentPage } from "@/components/storefront/StorefrontContentPage";
import { useShopSettings } from "@/hooks/useShopSettings";

const PrivacyPolicy = () => {
  const { data: settings } = useShopSettings();
  const company = (settings?.company || {}) as Record<string, string | null | undefined>;

  return (
    <StorefrontContentPage mainClassName="flex-1 py-16 pt-24">
        <PrivacyPolicyContent
          variant="storefront"
          shopName={company.name || settings?.tenant_name || "denne webshop"}
          company={{
            name: company.name || settings?.tenant_name || undefined,
            cvr: company.cvr || undefined,
            address: company.address || undefined,
            email: company.email || undefined,
            phone: company.phone || undefined,
          }}
        />
    </StorefrontContentPage>
  );
};

export default PrivacyPolicy;
