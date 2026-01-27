import { Loader2 } from "lucide-react";
import PlatformKontakt from "@/pages/platform/PlatformKontakt";
import ShopContact from "@/pages/ShopContact";
import { useShopSettings } from "@/hooks/useShopSettings";

// Domains that should ALWAYS show the platform contact page
const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "webprinter.dk";
const MARKETING_DOMAINS = [
  ROOT_DOMAIN,
  `www.${ROOT_DOMAIN}`,
  "webprinter-platform.vercel.app",
];

const ContactRouter = () => {
  const settings = useShopSettings();
  const hostname = window.location.hostname;
  const isMarketing = MARKETING_DOMAINS.includes(hostname);

  if (isMarketing) {
    return <PlatformKontakt />;
  }

  if (settings.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

  return <ShopContact />;
};

export default ContactRouter;
