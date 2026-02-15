import { type ReactElement, useEffect } from 'react';
import { useNavigate, Routes, Route, Link } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Dashboard } from '@/components/admin/Dashboard';
import { ProductOverview } from '@/components/admin/ProductOverview';
import { ProductPriceManager } from '@/components/admin/ProductPriceManager';
import { ProductCreator } from '@/components/admin/ProductCreator';
import { SeoManager } from '@/components/admin/SeoManager';
import { OrderManager } from '@/components/admin/OrderManager';
import AdminMessages from '@/components/admin/AdminMessages';
import DomainSettings from '@/components/admin/DomainSettings';
import BrandingSettings from '@/components/admin/BrandingSettings';
import TenantBrandingSettings from '@/components/admin/TenantBrandingSettings';
import TenantBrandingSettingsV2 from '@/components/admin/TenantBrandingSettingsV2';
import MasterBrandingTemplate from '@/components/admin/MasterBrandingTemplate';
import SubscriptionSettings from '@/components/admin/SubscriptionSettings';
import ShopSettings from '@/components/admin/ShopSettings';
import TenantPaymentSettings from '@/components/admin/TenantPaymentSettings';
import { TenantOverview } from '@/components/admin/TenantOverview';
import { PricingModules } from '@/components/admin/PricingModules';
import { MachinePricingManager } from '@/components/admin/MachinePricingManager';
import { AdminUpdates } from '@/components/admin/AdminUpdates';
import { TenantUpdates } from '@/components/admin/TenantUpdates';
import AssetsLibrary from '@/components/admin/AssetsLibrary';
import MasterResources from '@/components/admin/MasterResources';
import DesignResources from '@/components/admin/DesignResources';
import MasterTemplatesPage from '@/pages/admin/MasterTemplatesPage';
import TenantTemplatesPage from '@/pages/admin/TenantTemplatesPage';
import SitesAdmin from '@/pages/admin/SitesAdmin';
import DesignerTemplateManager from '@/components/admin/DesignerTemplateManager';
import ColorProfilesManager from '@/components/admin/ColorProfilesManager';
import { AddonLibraryManager } from '@/components/admin/AddonLibraryManager';
import AdminCompanyHub from '@/pages/admin/AdminCompanyHub';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { PlatformSeoAdmin } from '@/components/admin/platform-seo';
import { SearchConsoleCallback } from '@/components/admin/platform-seo/SearchConsoleCallback';
// POD (Print on Demand) imports
import PodAdmin from '@/pages/admin/PodAdmin';
import PodKatalog from '@/pages/admin/PodKatalog';
import PodOrdrer from '@/pages/admin/PodOrdrer';
import PodBetaling from '@/pages/admin/PodBetaling';
import { Pod2Admin } from '@/pages/admin/Pod2Admin';
import { Pod2Katalog } from '@/pages/admin/Pod2Katalog';
import { ShopModules } from '@/components/admin/ShopModules';
import { PricingHub } from '@/pages/admin/PricingHub';
import { useTenantModules } from '@/hooks/useTenantModules';
import type { ShopModuleId } from '@/lib/modules/catalog';

function AdminModuleGate({ moduleId, children }: { moduleId: ShopModuleId; children: ReactElement }) {
  const modules = useTenantModules();

  if (modules.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!modules.isModuleEnabled(moduleId)) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
        <h2 className="text-xl font-semibold">Modul er slået fra</h2>
        <p className="text-sm text-muted-foreground">
          Dette modul er ikke aktivt for den valgte shop. Aktiver det under Shop Moduler.
        </p>
        <Button asChild>
          <Link to="/admin/moduler">Gå til Shop Moduler</Link>
        </Button>
      </div>
    );
  }

  return children;
}


export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();

  useEffect(() => {
    const checkAccess = async () => {
      if (!roleLoading && !isAdmin) {
        // If user is logged out (no session), just redirect quietly
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          // Logged in but no admin role -> Real access denied
          toast.error('Adgang nægtet. Administrator rettigheder påkrævet.');
        }

        navigate('/');
      }
    };

    checkAccess();
  }, [isAdmin, roleLoading, navigate]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Adgang nægtet</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Du mangler administratorrettigheder, eller adgangskontrollen kunne ikke verificeres.
        </p>
        <Button onClick={() => navigate('/')}>Tilbage til forsiden</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SidebarProvider>
        <div className="flex-1 flex w-full">
          <AdminSidebar />

          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <AdminHeader />

            <div className="flex-1 p-6 overflow-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} /> {/* Changed to Dashboard */}
                <Route path="/products" element={<ProductOverview />} /> {/* Moved ProductOverview to /products */}
                <Route path="/prismoduler" element={<PricingModules />} />
                <Route
                  path="/machine-pricing"
                  element={
                    <AdminModuleGate moduleId="machine-pricing">
                      <MachinePricingManager />
                    </AdminModuleGate>
                  }
                />
                <Route
                  path="/designer-templates"
                  element={
                    <AdminModuleGate moduleId="print-designer">
                      <DesignerTemplateManager />
                    </AdminModuleGate>
                  }
                />
                <Route path="/farveprofiler" element={<ColorProfilesManager />} />
                <Route path="/tilvalgsbibliotek" element={<AddonLibraryManager />} />
                <Route path="/product/:slug" element={<ProductPriceManager />} />
                <Route path="/create-product" element={<ProductCreator />} />
                <Route path="/seo" element={<SeoManager />} />
                <Route path="/kunder" element={<OrderManager />} />
                <Route
                  path="/companyhub"
                  element={
                    <AdminModuleGate moduleId="company-hub">
                      <AdminCompanyHub />
                    </AdminModuleGate>
                  }
                />
                <Route path="/beskeder" element={<AdminMessages />} />
                {/* Min Konto routes */}
                <Route path="/domaene" element={<DomainSettings />} />
                <Route
                  path="/branding"
                  element={
                    <AdminModuleGate moduleId="site-design">
                      <TenantBrandingSettings />
                    </AdminModuleGate>
                  }
                />
                <Route
                  path="/branding-v2"
                  element={
                    <AdminModuleGate moduleId="site-design">
                      <TenantBrandingSettingsV2 />
                    </AdminModuleGate>
                  }
                />
                <Route
                  path="/sites"
                  element={
                    <AdminModuleGate moduleId="site-design">
                      <SitesAdmin />
                    </AdminModuleGate>
                  }
                />
                <Route path="/abonnement" element={<SubscriptionSettings />} />
                <Route path="/indstillinger" element={<ShopSettings />} />
                <Route path="/indstillinger/betaling" element={<TenantPaymentSettings />} />
                <Route path="/moduler" element={<ShopModules />} />
                {/* Platform Admin Routes */}
                <Route path="/tenants" element={<TenantOverview />} />
                <Route path="/updates" element={<AdminUpdates />} />
                <Route path="/tenant-updates" element={<TenantUpdates />} />
                <Route path="/assets" element={<AssetsLibrary />} />
                <Route path="/resources" element={<MasterResources />} />
                <Route path="/ressourcer/designs" element={<DesignResources />} />
                <Route path="/branding-template" element={<MasterBrandingTemplate />} />
                <Route path="/master-skabeloner" element={<MasterTemplatesPage />} />
                <Route path="/skabeloner" element={<TenantTemplatesPage />} />
                <Route path="/platform-seo" element={<PlatformSeoAdmin />} />
                <Route path="/platform-seo/callback" element={<SearchConsoleCallback />} />
                {/* Print on Demand Routes */}
                <Route path="/pod" element={<PodAdmin />} />
                <Route
                  path="/pod-katalog"
                  element={
                    <AdminModuleGate moduleId="print-on-demand">
                      <PodKatalog />
                    </AdminModuleGate>
                  }
                />
                <Route path="/pod-ordrer" element={<PodOrdrer />} />
                <Route path="/pod-betaling" element={<PodBetaling />} />
                {/* Print on Demand v2 Routes */}
                <Route path="/pod2" element={<Pod2Admin />} />
                <Route path="/pod2-katalog" element={<Pod2Katalog />} />
                {/* Pricing Hub Route */}
                <Route path="/pricing-hub" element={<PricingHub />} />
              </Routes>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
