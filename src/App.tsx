import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PageTracker } from "@/hooks/usePageTracking";
import Index from "./pages/Index";
import SubdomainRouter from "./pages/SubdomainRouter"; // Import Router
import About from "./pages/About";
import ContactRouter from "./pages/ContactRouter";
import Terms from "./pages/Terms";
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
import GrafiskVejledning from "./pages/GrafiskVejledning";
import NotFound from "./pages/NotFound";

import { PreviewInteractionManager } from "@/components/preview/PreviewInteractionManager";
import { PreviewRouteRedirect } from "@/components/preview/PreviewRouteRedirect";

// Cookie consent
import { CookieConsentProvider, CookieBanner, CookieSettingsDialog } from "@/components/consent";

// Platform SEO head injection (platform pages only)
import { PlatformSeoHead } from "@/components/platform-seo/PlatformSeoHead";

const queryClient = new QueryClient();
const ProductPrice = lazy(() => import("./pages/ProductPrice"));
const Admin = lazy(() => import("./pages/Admin"));
const PreviewShop = lazy(() => import("./pages/PreviewShop"));
const FileUploadConfiguration = lazy(() => import("./pages/FileUploadConfiguration"));
const Designer = lazy(() => import("./pages/Designer"));
const CompanyHub = lazy(() => import("./pages/CompanyHub"));
const PlatformPriser = lazy(() => import("./pages/platform/PlatformPriser"));
const PlatformWhiteLabel = lazy(() => import("./pages/platform/PlatformWhiteLabel"));
const PlatformBeregning = lazy(() => import("./pages/platform/PlatformBeregning"));
const PlatformOrderFlow = lazy(() => import("./pages/platform/PlatformOrderFlow"));
const PlatformOnlineDesigner = lazy(() => import("./pages/platform/PlatformOnlineDesigner"));
const PlatformPrivacyPolicy = lazy(() => import("./pages/platform/PlatformPrivacyPolicy"));
const PlatformHandelsbetingelser = lazy(() => import("./pages/platform/PlatformHandelsbetingelser"));
const Cookiepolitik = lazy(() => import("./pages/platform/Cookiepolitik"));

const routeFallback = (
  <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
    Indlaeser side...
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <CookieConsentProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <CookieBanner />
            <CookieSettingsDialog />
            <PreviewInteractionManager />
            <PageTracker />
            <PlatformSeoHead />
            <Suspense fallback={routeFallback}>
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
                <Route
                  path="/kontakt"
                  element={
                    <PreviewRouteRedirect>
                      <ContactRouter />
                    </PreviewRouteRedirect>
                  }
                />

                {/* Dynamic Root: Shop on localhost (dev), Landing Page on main domain, Shop on subdomains */}
                <Route
                  path="/"
                  element={
                    <PreviewRouteRedirect>
                      <SubdomainRouter />
                    </PreviewRouteRedirect>
                  }
                />

                <Route
                  path="/om-os"
                  element={
                    <PreviewRouteRedirect>
                      <About />
                    </PreviewRouteRedirect>
                  }
                />
                <Route
                  path="/betingelser"
                  element={
                    <PreviewRouteRedirect>
                      <Terms />
                    </PreviewRouteRedirect>
                  }
                />
                <Route
                  path="/produkter"
                  element={
                    <PreviewRouteRedirect>
                      <Shop />
                    </PreviewRouteRedirect>
                  }
                />
                <Route
                  path="/shop"
                  element={
                    <PreviewRouteRedirect>
                      <Shop />
                    </PreviewRouteRedirect>
                  }
                />
                <Route
                  path="/prisberegner"
                  element={
                    <PreviewRouteRedirect>
                      <Shop />
                    </PreviewRouteRedirect>
                  }
                />
                <Route
                  path="/produkt/:slug"
                  element={
                    <PreviewRouteRedirect>
                      <ProductPrice />
                    </PreviewRouteRedirect>
                  }
                />
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
                {/* Backward-compatible account aliases */}
                <Route path="/konto" element={<Navigate to="/min-konto" replace />} />
                <Route path="/konto/ordrer" element={<Navigate to="/min-konto/ordrer" replace />} />
                <Route path="/konto/adresser" element={<Navigate to="/min-konto/adresser" replace />} />
                <Route path="/konto/indstillinger" element={<Navigate to="/min-konto/indstillinger" replace />} />
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
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </CookieConsentProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
