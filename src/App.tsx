import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PageTracker } from "@/hooks/usePageTracking";
import Index from "./pages/Index";
import SubdomainRouter from "./pages/SubdomainRouter"; // Import Router
import About from "./pages/About";
import ContactRouter from "./pages/ContactRouter";
import CookiePolicyRouter from "./pages/CookiePolicyRouter";
import Terms from "./pages/Terms";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ProductPrice from "./pages/ProductPrice";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import AdminLogin from "./pages/AdminLogin";
import Shop from "./pages/Shop";
import Profile from "./pages/Profile";
import Sitemap from "./pages/Sitemap";
import MyOrders from "./pages/MyOrders";
import MyAccount from "./pages/MyAccount";
import MyAddresses from "./pages/MyAddresses";
import MySettings from "./pages/MySettings";
import TenantSignup from "./pages/TenantSignup";
import PreviewStorefront from "./pages/PreviewStorefront";
import PreviewShop from "./pages/PreviewShop";
import FileUploadConfiguration from "./pages/FileUploadConfiguration";
import LlmsTxt from "./pages/LlmsTxt";
import CanvaReturn from "./pages/CanvaReturn";
import GrafiskVejledning from "./pages/GrafiskVejledning";
import Designer from "./pages/Designer";
import CompanyHub from "./pages/CompanyHub";
import NotFound from "./pages/NotFound";

// Platform-only pages
import PlatformPriser from "./pages/platform/PlatformPriser";
import PlatformWhiteLabel from "./pages/platform/PlatformWhiteLabel";
import PlatformBeregning from "./pages/platform/PlatformBeregning";
import PlatformOrderFlow from "./pages/platform/PlatformOrderFlow";
import PlatformOnlineDesigner from "./pages/platform/PlatformOnlineDesigner";
import PlatformPrivacyPolicy from "./pages/platform/PlatformPrivacyPolicy";
import PlatformHandelsbetingelser from "./pages/platform/PlatformHandelsbetingelser";

// Cookie consent
import { CookieConsentProvider, CookieBanner, CookieSettingsDialog } from "@/components/consent";
// Platform SEO head injection (platform pages only)
import { PlatformSeoHead } from "@/components/platform-seo/PlatformSeoHead";
import { SupabaseDataSyncBridge } from "@/components/system/SupabaseDataSyncBridge";
import { useShopSettings } from "@/hooks/useShopSettings";

const queryClient = new QueryClient();

const getPageTransition = (style?: string, disabled = false) => {
  if (disabled) {
    return {
      initial: { opacity: 1 },
      animate: { opacity: 1 },
      exit: { opacity: 1 },
      transition: { duration: 0 },
    };
  }

  switch (style) {
    case "soft-depth":
      return {
        initial: { opacity: 0, y: 10, scale: 0.992, filter: "blur(6px)" },
        animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
        exit: { opacity: 0, y: -6, scale: 0.996, filter: "blur(3px)" },
        transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const },
      };
    case "editorial-rise":
      return {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] as const },
      };
    case "direct-snap":
      return {
        initial: { opacity: 0, y: 4 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0 },
        transition: { duration: 0.14, ease: "easeOut" as const },
      };
    case "dark-focus":
      return {
        initial: { opacity: 0, scale: 0.996, filter: "blur(4px)" },
        animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
        exit: { opacity: 0, scale: 0.998, filter: "blur(2px)" },
        transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
      };
    case "subtle-fade":
    default:
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.18, ease: "easeOut" as const },
      };
  }
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const shopSettings = useShopSettings();
  const pageTransitionStyle = String((shopSettings.data?.branding as any)?.themeSettings?.pageTransitionStyle || "subtle-fade");
  const isHeavyAppRoute = location.pathname.startsWith("/admin") || location.pathname.startsWith("/designer");
  const transition = getPageTransition(pageTransitionStyle, Boolean(shouldReduceMotion || isHeavyAppRoute));

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={transition.initial}
        animate={transition.animate}
        exit={transition.exit}
        transition={transition.transition}
      >
        <Routes location={location}>
          {/* Local Dev Route for Tenant View */}
          <Route path="/local-tenant" element={<Shop />} />

          {/* Platform Marketing Page - accessible via /platform during development */}
          <Route path="/platform" element={<Index />} />

          {/* Platform Feature Pages */}
          <Route path="/priser" element={<PlatformPriser />} />
          <Route path="/white-label" element={<PlatformWhiteLabel />} />
          <Route path="/beregning" element={<PlatformBeregning />} />
          <Route path="/order-flow" element={<PlatformOrderFlow />} />
          <Route path="/online-designer" element={<PlatformOnlineDesigner />} />

          {/* Platform Legal Pages */}
          <Route path="/privacy-policy" element={<PlatformPrivacyPolicy />} />
          <Route path="/handelsbetingelser" element={<PlatformHandelsbetingelser />} />
          <Route path="/cookiepolitik" element={<CookiePolicyRouter />} />
          <Route path="/cookies" element={<CookiePolicyRouter />} />

          {/* Contact - platform on marketing domain, tenant on shop domains */}
          <Route path="/kontakt" element={<ContactRouter />} />

          {/* Dynamic Root: Shop on localhost (dev), Landing Page on main domain, Shop on subdomains */}
          <Route path="/" element={<SubdomainRouter />} />

          <Route path="/om-os" element={<About />} />
          <Route path="/betingelser" element={<Terms />} />
          <Route path="/vilkaar" element={<Terms />} />
          <Route path="/privatliv" element={<PrivacyPolicy />} />
          <Route path="/produkter" element={<Shop />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/prisberegner" element={<Shop />} />
          <Route path="/produkt/:slug" element={<ProductPrice />} />
          <Route path="/checkout/konfigurer" element={<FileUploadConfiguration />} />
          <Route path="/canva-return" element={<CanvaReturn />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/opret-shop" element={<TenantSignup />} />
          <Route path="/profil" element={<Profile />} />
          <Route path="/company" element={<CompanyHub />} />
          <Route path="/mine-ordrer" element={<MyOrders />} />
          <Route path="/min-konto" element={<MyAccount />} />
          <Route path="/min-konto/ordrer" element={<MyOrders />} />
          <Route path="/min-konto/adresser" element={<MyAddresses />} />
          <Route path="/min-konto/indstillinger" element={<MySettings />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="/sitemap.xml" element={<Sitemap />} />
          <Route path="/llms.txt" element={<LlmsTxt />} />
          <Route path="/preview" element={<PreviewStorefront />} />
          <Route path="/preview-shop" element={<PreviewShop />} />
          <Route path="/grafisk-vejledning" element={<GrafiskVejledning />} />
          {/* Print Product Designer */}
          <Route path="/designer" element={<Designer />} />
          <Route path="/designer/:variantId" element={<Designer />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <CookieConsentProvider>
        <TooltipProvider>
          <SupabaseDataSyncBridge />
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <CookieBanner />
            <CookieSettingsDialog />
            <PageTracker />
            <PlatformSeoHead />
            <AnimatedRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </CookieConsentProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
