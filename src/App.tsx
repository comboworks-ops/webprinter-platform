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
import Contact from "./pages/Contact";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PageTracker />
          <Routes>
            {/* Dynamic Root: Landing Page on main domain, Shop on subdomains */}
            <Route path="/" element={<SubdomainRouter />} />

            <Route path="/om-os" element={<About />} />
            <Route path="/kontakt" element={<Contact />} />
            <Route path="/betingelser" element={<Terms />} />
            <Route path="/produkter" element={<Shop />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/prisberegner" element={<Shop />} />
            <Route path="/produkt/:slug" element={<ProductPrice />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/opret-shop" element={<TenantSignup />} />
            <Route path="/profil" element={<Profile />} />
            <Route path="/mine-ordrer" element={<MyOrders />} />
            <Route path="/min-konto" element={<MyAccount />} />
            <Route path="/min-konto/ordrer" element={<MyOrders />} />
            <Route path="/min-konto/adresser" element={<MyAddresses />} />
            <Route path="/min-konto/indstillinger" element={<MySettings />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="/sitemap.xml" element={<Sitemap />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
