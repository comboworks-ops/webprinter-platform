import { Loader2 } from "lucide-react";

import { useShopSettings } from "@/hooks/useShopSettings";
import ShopCookiePolicy from "@/pages/ShopCookiePolicy";
import Cookiepolitik from "@/pages/platform/Cookiepolitik";

const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "webprinter.dk";
const MARKETING_DOMAINS = [
  ROOT_DOMAIN,
  `www.${ROOT_DOMAIN}`,
  "webprinter-platform.vercel.app",
];

const CookiePolicyRouter = () => {
  const settings = useShopSettings();
  const hostname = window.location.hostname;
  const isMarketing = MARKETING_DOMAINS.includes(hostname);
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  if (isMarketing) {
    return <Cookiepolitik />;
  }

  if (settings.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (settings.isError) {
    if (isLocalhost) {
      return <ShopCookiePolicy />;
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Midlertidig forbindelsesfejl</h1>
        <p className="text-muted-foreground">Vi kunne ikke hente shop-indstillinger lige nu. Prøv igen om et øjeblik.</p>
        <p className="text-xs text-muted-foreground mt-4">{hostname}</p>
      </div>
    );
  }

  if (!settings.data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Shop ikke fundet</h1>
        <p className="text-muted-foreground">Vi kunne ikke finde en shop på dette domæne.</p>
        <p className="text-xs text-muted-foreground mt-4">{hostname}</p>
      </div>
    );
  }

  return <ShopCookiePolicy />;
};

export default CookiePolicyRouter;
