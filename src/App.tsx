import { IconPackProvider } from "@/components/icons/IconFamily";
import { StorefrontTooltipLayer } from "@/components/StorefrontTooltipLayer";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { OnlinetryksagerAnalytics } from '@/components/consent/OnlinetryksagerAnalytics';
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
import MyDesigns from "./pages/MyDesigns";
import { CustomerAccountProvider } from "./components/account/CustomerAccountContext";
import TenantSignup from "./pages/TenantSignup";
import PreviewStorefront from "./pages/PreviewStorefront";
import PreviewShop from "./pages/PreviewShop";
import FileUploadConfiguration from "./pages/FileUploadConfiguration";
import LlmsTxt from "./pages/LlmsTxt";
import CanvaReturn from "./pages/CanvaReturn";
import GrafiskVejledning from "./pages/GrafiskVejledning";
import Designer from "./pages/Designer";
import BrochureProductPreview from "./pages/BrochureProductPreview";
import BrochureNativeProductPreview from './pages/BrochureNativeProductPreview';
import BrochureShopPreview from './pages/BrochureShopPreview';
import { lazy, Suspense } from 'react';
const RollLabelCataloguePreview = import.meta.env.DEV ? lazy(() => import('./pages/RollLabelCataloguePreview')) : null;
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
import { IS_ISOLATED_PREVIEW, IS_ISOLATED_CHECKOUT_TEST } from "@/lib/isolatedPreview";

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
  const isAccountRoute = location.pathname === "/mine-ordrer" || location.pathname.startsWith("/min-konto");
  const isHeavyAppRoute = location.pathname.startsWith("/admin") || location.pathname.startsWith("/designer");
  const transition = getPageTransition(pageTransitionStyle, Boolean(shouldReduceMotion || isHeavyAppRoute || isAccountRoute));

  return (
    <IconPackProvider packId={shopSettings.data?.branding?.selectedIconPackId}>
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
          <Route element={<CustomerAccountProvider />}>
            <Route path="/mine-ordrer" element={<MyOrders />} />
            <Route path="/min-konto" element={<MyAccount />} />
            <Route path="/min-konto/ordrer" element={<MyOrders />} />
            <Route path="/min-konto/designs" element={<MyDesigns />} />
            <Route path="/min-konto/adresser" element={<MyAddresses />} />
            <Route path="/min-konto/indstillinger" element={<MySettings />} />
          </Route>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="/sitemap.xml" element={<Sitemap />} />
          <Route path="/llms.txt" element={<LlmsTxt />} />
          <Route path="/preview" element={<PreviewStorefront />} />
          <Route path="/preview-shop" element={<PreviewShop />} />
          <Route path="/grafisk-vejledning" element={<GrafiskVejledning />} />
          {/* Print Product Designer */}
          <Route path="/designer" element={<Designer />} />
          {import.meta.env.DEV && <Route path="/brochure-preview" element={<BrochureProductPreview />} />}
          {import.meta.env.DEV && <Route path="/brochure-native-preview" element={<BrochureNativeProductPreview />} />}
          {import.meta.env.DEV && <Route path="/brochure-shop-preview" element={<BrochureShopPreview />} />}
          {import.meta.env.DEV && RollLabelCataloguePreview && <Route path="/roll-labels-preview" element={<Suspense fallback={<p>Åbner katalogprøven…</p>}><RollLabelCataloguePreview /></Suspense>} />}
          <Route path="/designer/:variantId" element={<Designer />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
    </IconPackProvider>
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
            {IS_ISOLATED_PREVIEW && (
              <aside aria-label="Testversion" className="border-b border-amber-200 bg-amber-50 py-2 text-center text-sm leading-relaxed text-amber-950" style={{ paddingInline: 'var(--ui-page-gutter, 1rem)' }}>
                <strong>Testversion</strong> · {IS_ISOLATED_CHECKOUT_TEST
                    ? "Kun Stripe-testbetalinger — ingen rigtige penge. Separat testdatabase; automatisk email er slået fra."
                    : "Separat testdatabase. Betaling og udsendelse af emails er slået fra."}
                <nav aria-label="Testbutikker" className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                  <a className="underline py-1" href="/shop?tenantId=00000000-0000-0000-0000-000000000000">Webprinter</a>
                  <a className="underline py-1" href="/shop?tenantId=7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba">Salgsmapper</a>
                  <a className="underline py-1" href="/shop?tenantId=7cb851f5-c792-40b1-a79a-1f7c7b5f668c">Onlinetryksager</a>
                </nav>
              </aside>
            )}
            <CookieBanner />
            <CookieSettingsDialog />
            <PageTracker />
            <OnlinetryksagerAnalytics />
            <PlatformSeoHead />
            <AnimatedRoutes />
            <StorefrontTooltipLayer />
          </BrowserRouter>
        </TooltipProvider>
      </CookieConsentProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
