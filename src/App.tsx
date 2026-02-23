import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PageTracker } from "@/hooks/usePageTracking";
import Index from "./pages/Index";
import SubdomainRouter from "./pages/SubdomainRouter"; // Import Router
import About from "./pages/About";
import ContactRouter from "./pages/ContactRouter";
import Terms from "./pages/Terms";
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

import { PreviewInteractionManager } from "@/components/preview/PreviewInteractionManager";

// Cookie consent
import { CookieConsentProvider, CookieBanner, CookieSettingsDialog } from "@/components/consent";
import Cookiepolitik from "./pages/platform/Cookiepolitik";

// Platform SEO head injection (platform pages only)
import { PlatformSeoHead } from "@/components/platform-seo/PlatformSeoHead";
import { SupabaseDataSyncBridge } from "@/components/system/SupabaseDataSyncBridge";

const queryClient = new QueryClient();

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
            <PreviewInteractionManager />
            <PageTracker />
            <PlatformSeoHead />
            <Routes>
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
              <Route path="/cookiepolitik" element={<Cookiepolitik />} />

              {/* Contact - platform on marketing domain, tenant on shop domains */}
              <Route path="/kontakt" element={<ContactRouter />} />

              {/* Dynamic Root: Shop on localhost (dev), Landing Page on main domain, Shop on subdomains */}
              <Route path="/" element={<SubdomainRouter />} />

              <Route path="/om-os" element={<About />} />
              <Route path="/betingelser" element={<Terms />} />
              <Route path="/produkter" element={<Shop />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/prisberegner" element={<Shop />} />
              <Route path="/produkt/:slug" element={<ProductPrice />} />
              <Route path="/checkout/konfigurer" element={<FileUploadConfiguration />} />
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
              <Route path="/preview" element={<PreviewStorefront />} />
              <Route path="/preview-shop" element={<PreviewShop />} />
              <Route path="/grafisk-vejledning" element={<GrafiskVejledning />} />
              {/* Print Product Designer */}
              <Route path="/designer" element={<Designer />} />
              <Route path="/designer/:variantId" element={<Designer />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CookieConsentProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
